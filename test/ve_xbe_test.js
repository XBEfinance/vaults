/* eslint-disable no-await-in-loop */
/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { accounts, contract } = require('@openzeppelin/test-environment');
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require('./utils/common.js');
const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
} = require('./utils/deploy_strategy_infrastructure.js');

const { ZERO_ADDRESS } = constants;
const MockContract = contract.fromArtifact('MockContract');

describe('VeXBE', () => {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let mockXBE;
  let mockCX;
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let vaultWithXBExCXStrategy;

  let deployment;

  const depositType = {
    DEPOSIT_FOR_TYPE: new BN(0),
    CREATE_LOCK_TYPE: new BN(1),
    INCREASE_LOCK_AMOUNT: new BN(2),
    INCREASE_UNLOCK_TIME: new BN(3),
  };

  async function deploy() {
    deployment = deployInfrastructure(owner, alice, bob, defaultParams);
    [
      mockXBE,
      mockCX,
      xbeInflation,
      bonusCampaign,
      veXBE,
      voting,
    ] = await deployment.proceed();
  }

  async function deployAndConfigure() {
    await deploy();
    await deployment.configure();
  }

  async function approveAndCreateLock(from, value, unlockTime) {
    await mockXBE.approve(veXBE.address, value, { from });
    return veXBE.createLock(value, unlockTime, { from });
  }

  async function getTxBlockTimestamp(tx) {
    return new BN(
      (await web3.eth.getBlock(tx.receipt.blockNumber)).timestamp.toString(),
    );
  }

  async function shiftToNextWeek() {
    const latestTimestamp = await time.latest();
    const WEEK = await veXBE.WEEK();
    const latestFullWeek = latestTimestamp.div(WEEK).mul(WEEK);
    const timeShift = days(7).sub(latestTimestamp.sub(latestFullWeek));
    await time.increase(timeShift);
  }

  beforeEach(async () => {
    vaultWithXBExCXStrategy = await getMockTokenPrepared(
      alice,
      ether('100'),
      ether('1000'),
      owner,
    );
    await vaultWithXBExCXStrategy.approve(bob, ether('100'));
    await vaultWithXBExCXStrategy.transfer(bob, ether('100'));
    defaultParams.vaultWithXBExCXStrategyAddress = vaultWithXBExCXStrategy.address;
  });

  describe('Configuration', () => {
    beforeEach(deploy);

    it('should be correct configured', async () => {
      const config = {
        token: mockXBE.address,
        name: 'Voting Escrowed XBE',
        symbol: 'veXBE',
        version: '0.0.1',
      };
      await veXBE.configure(config.token, config.name, config.symbol, config.version);

      const admin = await veXBE.admin();
      const token = await veXBE.token();
      const name = await veXBE.name();
      const symbol = await veXBE.symbol();
      const version = await veXBE.version();

      expect(admin).to.be.bignumber.equal(owner);
      expect(token).to.be.bignumber.equal(config.token);
      expect(name).to.be.equal(config.name);
      expect(symbol).to.be.equal(config.symbol);
      expect(version).to.be.equal(config.version);

      await expectRevert(
        veXBE.configure(config.token, config.name, config.symbol, config.version),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('Lock and deposit', () => {
    beforeEach(deployAndConfigure);

    it('should revert with zero value', async () => {
      const unlockTime = (await time.latest()).add(days('7'));
      await expectRevert(veXBE.createLock(ZERO, unlockTime), '!zeroValue');
    });

    it('should revert if already locked tokens', async () => {
      const value = ether('1');
      const unlockTime = (await time.latest()).add(days('7'));

      await approveAndCreateLock(owner, value, unlockTime);

      await expectRevert(veXBE.createLock(value, unlockTime), 'withdrawOldTokensFirst');
    });

    it('should revert if unlock time not in future', async () => {
      const timeInPast = (await time.latest()).sub(days('1'));
      await expectRevert(veXBE.createLock(ether('1'), timeInPast), 'lockOnlyToFutureTime');
    });

    it('should revert if locktime greater then maxtime', async () => {
      const MAXTIME = await veXBE.MAXTIME();
      const unlockTime = (await time.latest()).add(MAXTIME).add(days('7'));
      const value = ether('1');

      await mockXBE.approve(veXBE.address, value);
      await expectRevert(veXBE.createLock(value, unlockTime), 'lockOnlyToValidFutureTime');
    });

    it('should correct createLock', async () => {
      const value = ether('1');
      const unlockTime = (await time.latest()).add(days('7'));
      const XBEBalanceBefore = await mockXBE.balanceOf(owner);
      const WEEK = await veXBE.WEEK();

      const createLock = await approveAndCreateLock(owner, value, unlockTime);
      const blockTimestamp = await getTxBlockTimestamp(createLock);
      const locktime = unlockTime.div(WEEK).mul(WEEK);

      expectEvent(createLock, 'Deposit', {
        provider: owner,
        value,
        locktime,
        _type: depositType.CREATE_LOCK_TYPE,
        ts: blockTimestamp,
      });
      expectEvent(createLock, 'Supply', {
        prevSupply: new BN(0),
        supply: value,
      });

      const XBEBalanceAfter = await mockXBE.balanceOf(owner);
      expect(XBEBalanceAfter).to.be.bignumber.equal(XBEBalanceBefore.sub(value));

      const lockStarts = await veXBE.lockStarts(owner);
      const lockedEnd = await veXBE.lockedEnd(owner);

      expect(lockStarts).to.be.bignumber.equal(blockTimestamp);
      expect(lockedEnd).to.be.bignumber.equal(locktime);
    });

    it('should correct deposit for other user', async () => {
      const value = ether('1');
      const WEEK = await veXBE.WEEK();
      const unlockTime = (await time.latest()).add(days('7'));
      const locktime = unlockTime.div(WEEK).mul(WEEK);

      await expectRevert(veXBE.depositFor(alice, ZERO, { from: owner }), '!zeroValue');
      await expectRevert(veXBE.depositFor(alice, value, { from: owner }), '!zeroLockedAmount');

      const approveValue = value.mul(new BN(2));

      await approveAndCreateLock(alice, value, unlockTime);

      const supplyBefore = await veXBE.supply();
      await mockXBE.approve(veXBE.address, value, { from: alice });
      const depositFor = await veXBE.depositFor(alice, value, { from: owner });

      const blockTimestamp = await getTxBlockTimestamp(depositFor);

      expectEvent(depositFor, 'Deposit', {
        provider: alice,
        value,
        locktime,
        _type: depositType.DEPOSIT_FOR_TYPE,
        ts: blockTimestamp,
      });
      expectEvent(depositFor, 'Supply', {
        prevSupply: supplyBefore,
        supply: supplyBefore.add(value),
      });

      await time.increase(days('20'));
      await expectRevert(veXBE.depositFor(alice, value, { from: owner }), 'lockExpired');
    });

    it('should correct increase amount', async () => {
      const value = ether('1');
      const WEEK = await veXBE.WEEK();
      const unlockTime = (await time.latest()).add(days('7'));
      const locktime = unlockTime.div(WEEK).mul(WEEK);

      await expectRevert(veXBE.increaseAmount(ZERO), '!zeroValue');
      await expectRevert(veXBE.increaseAmount(value), '!zeroLockedAmount');

      await approveAndCreateLock(owner, value, unlockTime);

      const supplyBefore = await veXBE.supply();
      await mockXBE.approve(veXBE.address, value);
      const increaseAmount = await veXBE.increaseAmount(value);
      const blockTimestamp = await getTxBlockTimestamp(increaseAmount);

      expectEvent(increaseAmount, 'Deposit', {
        provider: owner,
        value,
        locktime,
        _type: depositType.INCREASE_LOCK_AMOUNT,
        ts: blockTimestamp,
      });
      expectEvent(increaseAmount, 'Supply', {
        prevSupply: supplyBefore,
        supply: supplyBefore.add(value),
      });

      await time.increase(days('20'));
      await expectRevert(veXBE.increaseAmount(value), 'lockExpired');
    });

    it('should correct increase unlock time', async () => {
      const value = ether('1');
      const WEEK = await veXBE.WEEK();
      const unlockTime = (await time.latest()).add(days('7'));
      const locktime = unlockTime.div(WEEK).mul(WEEK);

      await expectRevert(veXBE.increaseUnlockTime(unlockTime), 'lockExpired');

      await approveAndCreateLock(owner, value, unlockTime);

      await expectRevert(veXBE.increaseUnlockTime(unlockTime), 'canOnlyIncreaseLockDuration');

      const MAXTIME = await veXBE.MAXTIME();
      const invalidFutureTime = (await time.latest()).add(MAXTIME).add(days('7'));
      await expectRevert(veXBE.increaseUnlockTime(invalidFutureTime), 'lockOnlyToValidFutureTime');

      const increasedUnlockTime = unlockTime.add(days(7));
      const expectedLockTime = increasedUnlockTime.div(WEEK).mul(WEEK);
      const supplyBefore = await veXBE.supply();

      const increaseUnlockTime = await veXBE.increaseUnlockTime(increasedUnlockTime);

      const blockTimestamp = await getTxBlockTimestamp(increaseUnlockTime);
      expectEvent(increaseUnlockTime, 'Deposit', {
        provider: owner,
        value: ZERO,
        locktime: expectedLockTime,
        _type: depositType.INCREASE_UNLOCK_TIME,
        ts: blockTimestamp,
      });
      expectEvent(increaseUnlockTime, 'Supply', {
        prevSupply: supplyBefore,
        supply: supplyBefore,
      });
    });

    it('should correct withdraw', async () => {
      const value = ether('1');
      const WEEK = await veXBE.WEEK();
      const unlockTime = (await time.latest()).add(days('7'));

      const createLock = await approveAndCreateLock(owner, value, unlockTime);

      await expectRevert(veXBE.withdraw(), 'lockDidntExpired');

      time.increase(days(7));

      const withdraw = await veXBE.withdraw();
      const ts = await getTxBlockTimestamp(withdraw);

      expectEvent(withdraw, 'Withdraw', {
        provider: owner,
        value,
        ts,
      });

      expectEvent(withdraw, 'Supply', {
        prevSupply: value,
        supply: ZERO,
      });
    });
  });

  describe('Ownership', () => {
    beforeEach(deployAndConfigure);

    it('should revert if not admin', async () => {
      expectRevert(veXBE.commitTransferOwnership(alice, { from: alice }), '!admin');
    });

    it('should revert if future admin is zero', async () => {
      const commitTransferOwnership = await veXBE.commitTransferOwnership(ZERO_ADDRESS, { from: owner });
      expectEvent(commitTransferOwnership, 'CommitOwnership', { admin: ZERO_ADDRESS });

      await expectRevert(veXBE.applyTransferOwnership({ from: owner }), 'adminIsZero');
    });

    it('should correct transfer ownership', async () => {
      const commitTransferOwnership = await veXBE.commitTransferOwnership(alice, { from: owner });
      const futureAdmin = await veXBE.futureAdmin();
      expectEvent(commitTransferOwnership, 'CommitOwnership', { admin: alice });
      expect(futureAdmin).to.be.bignumber.equal(alice);

      const applyTransferOwnership = await veXBE.applyTransferOwnership({ from: owner });
      const admin = await veXBE.admin();
      expectEvent(applyTransferOwnership, 'ApplyOwnership', { admin: alice });
      expect(admin).to.be.bignumber.equal(alice);
    });
  });

  describe('TotalSupply and BalanceOf', () => {
    beforeEach(deployAndConfigure);

    it('should reject balanceOfAt at future block', async () => {
      const latestBlock = await time.latestBlock();
      await expectRevert(veXBE.balanceOfAt(owner, latestBlock.add(new BN(100))), 'onlyPast');
    });

    it('should reject totalSupplyAt at future block', async () => {
      const latestBlock = await time.latestBlock();
      await expectRevert(veXBE.totalSupplyAt(latestBlock.add(new BN(100))), 'onlyPastAllowed');
    });

    it('should correct return balanceOf and totalSupply', async () => {
      const balanceOfOwner = await veXBE.balanceOf(owner);
      expect(balanceOfOwner).to.be.bignumber.equal(ZERO);

      await shiftToNextWeek();
      const value = ether('1');
      const unlockTime = (await time.latest()).add(days('14'));
      await approveAndCreateLock(owner, value, unlockTime);

      const ownerLastEpoch = await veXBE.userPointEpoch(owner);
      const { slope, bias, ts } = await veXBE.userPointHistory(owner, ownerLastEpoch);

      const balancePoints = [];

      for (let i = 0; i < 16; i += 1) {
        const [
          { value: latestBlock } = {},
          // {value: block} = {},
          { value: balance } = {},
          { value: totalSupply } = {},
        ] = await Promise.allSettled([
          web3.eth.getBlock('latest'),
          // time.latestBlock(),
          veXBE.balanceOf(owner),
          veXBE.totalSupply(),
        ]);

        let expectedBalance = bias.sub(slope.mul((new BN(latestBlock.timestamp)).sub(ts)));
        expectedBalance = expectedBalance < 0 ? ZERO : expectedBalance;
        expect(balance).to.be.bignumber.equal(expectedBalance);
        expect(totalSupply).to.be.bignumber.equal(balance);

        await time.increase(days(1));

        balancePoints.push({
          balance,
          totalSupply,
          block: latestBlock.number,
        });
      }

      // eslint-disable-next-line no-restricted-syntax
      for (const point of balancePoints) {
        const balance = await veXBE.balanceOfAt(owner, point.block);
        const totalSupply = await veXBE.totalSupplyAt(point.block);
        expect(balance).to.be.bignumber.equal(point.balance);
        expect(totalSupply).to.be.bignumber.equal(point.totalSupply);
      }
    });
  });

  describe('Utils', () => {
    beforeEach(deployAndConfigure);

    async function calcCheckpoints(point, initialEpoch, result) {
      const lastPoint = { ...point };
      const initialLastPoint = { ...lastPoint };
      const blockTimestamp = await getTxBlockTimestamp(result);
      const blockNumber = new BN(result.receipt.blockNumber);
      const WEEK = await veXBE.WEEK();
      let epoch = parseInt(initialEpoch, 10);
      let tI = lastPoint.ts.div(WEEK).mul(WEEK);

      let blockSlope = new BN(0);
      if (blockTimestamp > lastPoint.ts) {
        blockSlope = MULTIPLIER.mul(blockNumber.sub(lastPoint.blk)).div(blockNumber.sub(lastPoint.ts));
      }

      const pointHistory = [];

      for (let i = 0; i < 255; i += 1) {
        tI = tI.add(WEEK);
        let dSlope = ZERO;

        if (tI > blockTimestamp) {
          tI = blockTimestamp;
        } else {
          dSlope = await veXBE.slopeChanges(tI);
        }

        lastPoint.bias = lastPoint.bias.sub(lastPoint.slope.mul(tI.sub(lastPoint.ts)));
        lastPoint.slope = lastPoint.slope.add(dSlope);

        if (lastPoint.bias < ZERO) lastPoint.bias = ZERO;
        if (lastPoint.slope < ZERO) lastPoint.slope = ZERO;

        lastPoint.ts = tI;
        lastPoint.blk = initialLastPoint.blk.add(blockSlope.mul(tI.sub(initialLastPoint.ts).div(MULTIPLIER)));
        epoch += 1;

        if (tI == blockTimestamp) {
          lastPoint.blk = blockNumber;
          pointHistory.push({ epoch, point: { ...lastPoint } });
          break;
        } else {
          pointHistory.push({ epoch, point: { ...lastPoint } });
        }
      }

      return pointHistory;
    }

    it('should correct save checkpoint', async () => {
      const value = ether('1');
      const unlockTime = (await time.latest()).add(days('365'));
      await approveAndCreateLock(owner, value, unlockTime);
      await approveAndCreateLock(alice, value, unlockTime);

      const epoch = await veXBE.epoch();
      const lastPoint = await veXBE.pointHistory(epoch);

      await time.increase(days(730));

      const result = await veXBE.checkpoint();

      const points = await calcCheckpoints(lastPoint, epoch, result);

      const newEpoch = await veXBE.epoch();

      // eslint-disable-next-line no-restricted-syntax
      for (const historyPoint of points) {
        const { point: expectedPoint } = historyPoint;
        const point = await veXBE.pointHistory(historyPoint.epoch);
        expect(point.bias).to.be.bignumber.equal(expectedPoint.bias);
        expect(point.slope).to.be.bignumber.equal(expectedPoint.slope);
        expect(point.ts).to.be.bignumber.equal(expectedPoint.ts);
        expect(point.blk).to.be.bignumber.equal(expectedPoint.blk);
      }
    });

    it('should correct return last user slope', async () => {
      const value = ether('1');
      const unlockTime = (await time.latest()).add(days('7'));

      await approveAndCreateLock(owner, value, unlockTime);

      const slope = await veXBE.getLastUserSlope(owner);
      const uEpoch = await veXBE.userPointEpoch(owner);
      const userPointHistory = await veXBE.userPointHistory(owner, uEpoch);
      expect(slope).to.be.bignumber.equal(userPointHistory.slope);
    });

    it('should correct return point history ts', async () => {
      const value = ether('1');
      const unlockTime = (await time.latest()).add(days('7'));

      await approveAndCreateLock(owner, value, unlockTime);

      const uEpoch = await veXBE.userPointEpoch(owner);
      const ts = await veXBE.userPointHistoryTs(owner, uEpoch);
      const userPointHistory = await veXBE.userPointHistory(owner, uEpoch);
      expect(ts).to.be.bignumber.equal(userPointHistory.ts);
    });

    it('should correct change controller', async () => {
      await expectRevert(veXBE.changeController(alice, { from: alice }), '!controller');

      await veXBE.changeController(alice);
      const controller = await veXBE.controller();
      expect(controller).to.be.bignumber.equal(alice);
    });

    it('should correct commit and apply smartWalletChecker', async () => {
      await veXBE.commitSmartWalletChecker(alice);

      const futureSmartWalletChecker = await veXBE.futureSmartWalletChecker();
      expect(futureSmartWalletChecker).to.be.bignumber.equal(alice);

      await veXBE.applySmartWalletChecker();

      const smartWalletChecker = await veXBE.smartWalletChecker();
      expect(smartWalletChecker).to.be.bignumber.equal(futureSmartWalletChecker);
    });
  });
});
