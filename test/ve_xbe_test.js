
const chai = require("chai");
const {
  BN,
  // constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require("@openzeppelin/test-helpers");
const common = require("./utils/common.js");
const constants = require("./utils/constants.js");
const environment = require("./utils/environment.js");
const { people, setPeople } = require('./utils/accounts.js');
const { expect } = require("chai");
var Eth = require('web3-eth');

// const { constant } = require("lodash-es");
let mockXBE;
let mockCX;
let xbeInflation;
let bonusCampaign;
let veXBE;
let voting;
let votingStakingRewards;
let vaultWithXBExCXStrategy;
let mockedStrategy;
let deployment;

contract('VeXBE', (accounts) => {
  setPeople(accounts);


  beforeEach(async () => {
    [
      mockXBE,
      veXBE,
      bonusCampaign,
      voting,
      votingStakingRewards
    ] = await environment.getGroup(
      environment.defaultGroup,
        (key) => {
          return [
            "MockXBE",
            "VeXBE",
            "BonusCampaign",
            "Voting",
            "VotingStakingRewards",
          ].includes(key);
        }
      );

  });

  describe('Configuration', () => {


    it('should be correct configured', async () => {
      // const config = {
      //   token: mockXBE.address,
      //   name: 'Voting Escrowed XBE',
      //   symbol: 'veXBE',
      //   version: '0.0.1',
      // };
      // await veXBE.configure(config.token, config.name, config.symbol, config.version);

      const admin = await veXBE.admin();
      // const token = await veXBE.token();
      const name = await veXBE.name();
      const symbol = await veXBE.symbol();
      const version = await veXBE.version();

      expect(admin.toString()).to.be.equal(people.owner.toString());
      // expect(token.toString()).to.be.equal(mockXBE.address);
      expect(name.toString()).to.be.equal('Voting Escrowed XBE');
      expect(symbol.toString()).to.be.equal('veXBE');
      expect(version.toString()).to.be.equal('0.0.1');
      await expectRevert(
        veXBE.configure(
        mockXBE.address,
        voting.address,
        bonusCampaign.address,
        'Voting Escrowed XBE',
        'veXBE',
        '0.0.1',
        {from: people.owner}
        ), 'Initializable: contract is already initialized');

    });
  });

  describe('Lock and deposit', () => {

    it('should revert with zero value', async () => {
      const unlockTime = (await time.latest()).add(constants.time.days('7'));
      const xbeToDeposit = ether('1');
      await mockXBE.approve(votingStakingRewards.address, xbeToDeposit, { from: people.alice });
      const stakeReceipt = await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });
      await expectRevert(veXBE.createLock(constants.utils.ZERO, unlockTime), '!zeroValue');
    });

    it('should revert if unlock time not in future', async () => {
      const timeInPast = (await time.latest()).sub(constants.time.days('1'));
      const xbeToDeposit = ether('1');
      await mockXBE.approve(votingStakingRewards.address, xbeToDeposit, { from: people.alice });
      await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });
      await expectRevert(veXBE.createLock(xbeToDeposit, timeInPast), 'lockOnlyToFutureTime');
    });
    it('should revert if locktime greater then maxtime', async () => {
      const MAXTIME = await veXBE.MAXTIME();
      const unlockTime = (await time.latest()).add(MAXTIME).add(constants.time.days('7'));
      const xbeToDeposit = ether('1');
      await mockXBE.approve(votingStakingRewards.address, xbeToDeposit, { from: people.alice });
      await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });
      await expectRevert(veXBE.createLock(xbeToDeposit, unlockTime), 'lockOnlyToValidFutureTime');
    });

    it('should correct createLock', async () => {
      const XBEBalanceBefore = await mockXBE.balanceOf(people.alice);
      console.log("XBEBalanceBefore = ", XBEBalanceBefore.toString());

      const xbeToDeposit = ether('1');

      const lockTime = (await time.latest()).add(constants.time.months('1'));
      // await mockXBE.approve(veXBE.address, xbeToDeposit, { from: people.alice });
      await mockXBE.approve(votingStakingRewards.address, xbeToDeposit, { from: people.alice });
      const stakeReceipt = await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });
      const votingBalance = await votingStakingRewards.balanceOf(people.alice);
      // console.log("votingBalance = ", votingBalance.toString());

      const createLock = await veXBE.createLock(xbeToDeposit, lockTime, { from: people.alice });
      // const blockTimestamp = await getTxBlockTimestamp(createLock);

      // expectEvent(createLock, 'Deposit', {
      //   provider: people.alice,
      //   xbeToDeposit,
      //   locktime,
      //   _type: depositType.CREATE_LOCK_TYPE,
      //   ts: blockTimestamp,
      // });
      // expectEvent(createLock, 'Supply', {
      //   prevSupply: new BN(0),
      //   supply: xbeToDeposit,
      // });

      const XBEBalanceAfter = await mockXBE.balanceOf(people.alice);
      expect(XBEBalanceAfter.toString()).to.be.equal(XBEBalanceBefore.sub(xbeToDeposit).toString());

      const lockStarts = await veXBE.lockStarts(people.alice);
      const lockedEnd = await veXBE.lockedEnd(people.alice);

      // expect(lockStarts).to.be.bignumber.equal(blockTimestamp);
      // expect(lockedEnd.toString()).to.be.equal(lockTime.toString());
    });

    it('should correct withdraw after unlock time', async () => {
      await time.increase(constants.time.months('1'));
      const supplyBefore = await veXBE.supply();
      const withdraw = await veXBE.withdraw({from: people.alice});
      const supplyAfter = await veXBE.supply();
      expect(supplyAfter.toString()).to.be.equal((supplyBefore.sub(ether('1')).toString() ));
      // console.log(withdraw);
      // const timestamp = web3.eth.getBlock(withdraw.receipt.blockNumber).timestamp;
      // expectEvent(withdraw, 'Withdraw', {
      //   provider: people.alice,
      //   value: ether('1'),
      //   ts: timestamp
      // })

    });



    it('should correct increase amount', async () => {
      const value = ether('1');
      const WEEK = await veXBE.WEEK();
      const unlockTime = (await time.latest()).add(constants.time.days('7'));
      const locktime = unlockTime.div(WEEK).mul(WEEK);

      await expectRevert(veXBE.increaseAmount(constants.utils.ZERO), '!zeroValue');
      await expectRevert(veXBE.increaseAmount(value), '!zeroLockedAmount');

      await mockXBE.approve(votingStakingRewards.address, value, { from: people.alice });
      const stakeReceipt = await votingStakingRewards.stake(value, { from: people.alice });
      const votingBalance = await votingStakingRewards.balanceOf(people.alice);
      const createLock = await veXBE.createLock(value, unlockTime, { from: people.alice });


      const supplyBefore = await veXBE.supply();
      await mockXBE.approve(veXBE.address, value);
      const increaseAmount = await veXBE.increaseAmount(value, { from: people.alice });

      const supplyAfter = await veXBE.supply();
      expect(supplyAfter.toString()).to.be.equal((supplyBefore.add(value)).toString() );


      // const blockTimestamp = await getTxBlockTimestamp(increaseAmount);

      // expectEvent(increaseAmount, 'Deposit', {
      //   provider: people.owner,
      //   value,
      //   locktime,
      //   _type: depositType.INCREASE_LOCK_AMOUNT,
      //   ts: blockTimestamp,
      // });
      // expectEvent(increaseAmount, 'Supply', {
      //   prevSupply: supplyBefore,
      //   supply: supplyBefore.add(value),
      // });

      // await time.increase(constants.time.days('20'));
      // await expectRevert(veXBE.increaseAmount(value), 'lockExpired');
      await time.increase(constants.time.days('7'));
      const withdraw = await veXBE.withdraw({from: people.alice});


    });

    it('should correct increase unlock time', async () => {

      const value = ether('1');
      const WEEK = await veXBE.WEEK();
      const unlockTime = (await time.latest()).add(constants.time.days('7'));
      const locktime = unlockTime.div(WEEK).mul(WEEK);

      await mockXBE.approve(votingStakingRewards.address, value, { from: people.alice });
      const stakeReceipt = await votingStakingRewards.stake(value, { from: people.alice });
      const votingBalance = await votingStakingRewards.balanceOf(people.alice);
      const createLock = await veXBE.createLock(value, unlockTime, { from: people.alice });

      await expectRevert(veXBE.increaseUnlockTime(unlockTime, { from: people.alice }), 'canOnlyIncreaseLockDuration');

      const MAXTIME = await veXBE.MAXTIME();
      const invalidFutureTime = (await time.latest()).add(MAXTIME).add(constants.time.days('7'));
      await expectRevert(veXBE.increaseUnlockTime(invalidFutureTime, { from: people.alice }), 'lockOnlyToValidFutureTime');

      const increasedUnlockTime = unlockTime.add(constants.time.days(7));

      const lockedEndBefore = await veXBE.locked(people.alice);
      const increaseUnlockTime = await veXBE.increaseUnlockTime(increasedUnlockTime, { from: people.alice });
      const lockedEndAfter = await veXBE.locked(people.alice);
      console.log(lockedEndAfter.end.toString());
      console.log(lockedEndBefore.end.toString());
      // console.log(lockedEndAfter.end.toString());
      expect(lockedEndAfter.end.toString()).to.be.equal((lockedEndBefore.end.add(constants.time.days(7))).toString() );
      time.increase(constants.time.days(14));
      const withdraw = await veXBE.withdraw({from: people.alice});


    });


    it('should revert if already locked tokens', async () => {
      const value = ether('1');
      const unlockTime = (await time.latest()).add(constants.time.days('7'));

      await mockXBE.approve(votingStakingRewards.address, value, { from: people.alice });
      const stakeReceipt = await votingStakingRewards.stake(value, { from: people.alice });
      await veXBE.createLock(value, unlockTime, { from: people.alice })
      await expectRevert(veXBE.createLock(value, unlockTime, { from: people.alice }), 'withdrawOldTokensFirst');
      time.increase(constants.time.days(7));
      const withdraw = await veXBE.withdraw({from: people.alice});
    });
  });

  describe('people.ownership', () => {

    it('should revert if not admin', async () => {
      await expectRevert(veXBE.setVoting(people.alice, { from: people.alice }), '!admin');

    });

    it('should revert if future admin is zero', async () => {
      await expectRevert(veXBE.applyTransferOwnership(), 'adminIsZero', { from: people.owner });

    });

    it('should correct transfer ownership', async () => {
      const commitAdmin = await veXBE.commitTransferOwnership(people.bob, { from: people.owner });
      expectEvent(commitAdmin, 'CommitOwnership', {
        admin: people.bob
      });

      const futureAdmin = await veXBE.futureAdmin();
      expect(futureAdmin).to.be.equal(people.bob);
      const applyOwnership = await veXBE.applyTransferOwnership( { from: people.owner } );
      expectEvent(applyOwnership, 'ApplyOwnership', {
        admin: people.bob
      });
      const newAdmin = await veXBE.admin();
      expect(newAdmin).to.be.equal(people.bob);
      /// return ownership back to owner
      await veXBE.commitTransferOwnership(people.owner, { from: people.bob });
      await veXBE.applyTransferOwnership( { from: people.bob } );
      const oldAdmin = await veXBE.admin();
      expect(oldAdmin).to.be.equal(people.owner);
    });
  });

  describe('TotalSupply and BalanceOf', () => {

    it('should reject balanceOfAt at future block', async () => {
      const latestBlock = await time.latestBlock();
      await expectRevert(veXBE.balanceOfAt(people.owner, latestBlock.add(new BN(100))), 'onlyPast');
    });

    it('should reject totalSupplyAt at future block', async () => {
      const latestBlock = await time.latestBlock();
      await expectRevert(veXBE.totalSupplyAt(latestBlock.add(new BN(100))), 'onlyPastAllowed');
    });

    it('should correct return balanceOf and totalSupply', async () => {
      var eth = new Eth(Eth.givenProvider || 'ws://127.0.0.1:8545');
      const balanceOfowner = await veXBE.balanceOf(people.owner);
      expect(balanceOfowner.toString()).to.be.equal(constants.utils.ZERO.toString());
      console.log("here0");

      const latestTimestamp = await time.latest();
      const WEEK = await veXBE.WEEK();
      const latestFullWeek = latestTimestamp.div(WEEK).mul(WEEK);
      const timeShift = constants.time.days(7).sub(latestTimestamp.sub(latestFullWeek));
      await time.increase(timeShift);
      console.log("here1");
      const value = ether('1');
      const unlockTime = (await time.latest()).add(constants.time.days('14'));
      await mockXBE.approve(votingStakingRewards.address, value, { from: people.owner });
      const stakeReceipt = await votingStakingRewards.stake(value, { from: people.owner });
      await veXBE.createLock(value, unlockTime, { from: people.owner })

      const ownerLastEpoch = await veXBE.userPointEpoch(people.owner);
      const {  bias, slope, ts } = await veXBE.userPointHistory(people.owner, ownerLastEpoch);

      const balancePoints = [];
      console.log("here2");

      for (let i = 0; i < 16; i += 1) {
        const latestBlock = await  eth.getBlock('latest');
        const balance = await veXBE.balanceOf(people.owner);
        const totalSupply = await veXBE.totalSupply();

        console.log("here3");
        console.log("bias = ", bias.toString());
        console.log("slope = ", slope.toString());
        console.log("latestBlock.timestamp = ", latestBlock.timestamp.toString());
        console.log("ts = ", ts.toString());

        let expectedBalance = bias.sub(slope.mul((new BN(latestBlock.timestamp)).sub(ts)));
        expectedBalance = expectedBalance < 0 ? constants.utils.ZERO : expectedBalance;
        console.log("expectedBalance = ", expectedBalance.toString());
        console.log("balance = ", balance.toString());
        expect(balance.toString()).to.be.equal(expectedBalance.toString());
        expect(totalSupply.toString()).to.be.equal(balance.toString());
        console.log("here4");


        await time.increase(constants.time.days(1));

        balancePoints.push({
          balance,
          totalSupply,
          block: latestBlock.number,
        });
      }

      // eslint-disable-next-line no-restricted-syntax
      for (const point of balancePoints) {
        console.log("------------");
        const balance = await veXBE.balanceOfAt(people.owner, point.block);
        const totalSupply = await veXBE.totalSupplyAt(point.block);
        console.log('balance = ', balance.toString(), 'point.balance = ', point.balance.toString());
        console.log('totalSupply = ', totalSupply.toString(), 'point.totalSupply = ', point.totalSupply.toString());
        console.log('balance difference = ', balance.sub(point.balance).toString())
        // expect(balance.toString()).to.be.equal(point.balance.toString());
        // expect(totalSupply.toString()).to.be.equal(point.totalSupply.toString());
      }
    });
  });

  // describe('Utils', () => {
  //   beforeEach(deployAndConfigure);

  //   async function calcCheckpoints(point, initialEpoch, result) {
  //     const lastPoint = { ...point };
  //     const initialLastPoint = { ...lastPoint };
  //     const blockTimestamp = await getTxBlockTimestamp(result);
  //     const blockNumber = new BN(result.receipt.blockNumber);
  //     const WEEK = await veXBE.WEEK();
  //     let epoch = parseInt(initialEpoch, 10);
  //     let tI = lastPoint.ts.div(WEEK).mul(WEEK);

  //     let blockSlope = new BN(0);
  //     if (blockTimestamp > lastPoint.ts) {
  //       blockSlope = MULTIPLIER.mul(blockNumber.sub(lastPoint.blk)).div(blockNumber.sub(lastPoint.ts));
  //     }

  //     const pointHistory = [];

  //     for (let i = 0; i < 255; i += 1) {
  //       tI = tI.add(WEEK);
  //       let dSlope = ZERO;

  //       if (tI > blockTimestamp) {
  //         tI = blockTimestamp;
  //       } else {
  //         dSlope = await veXBE.slopeChanges(tI);
  //       }

  //       lastPoint.bias = lastPoint.bias.sub(lastPoint.slope.mul(tI.sub(lastPoint.ts)));
  //       lastPoint.slope = lastPoint.slope.add(dSlope);

  //       if (lastPoint.bias < ZERO) lastPoint.bias = ZERO;
  //       if (lastPoint.slope < ZERO) lastPoint.slope = ZERO;

  //       lastPoint.ts = tI;
  //       lastPoint.blk = initialLastPoint.blk.add(blockSlope.mul(tI.sub(initialLastPoint.ts).div(MULTIPLIER)));
  //       epoch += 1;

  //       if (tI == blockTimestamp) {
  //         lastPoint.blk = blockNumber;
  //         pointHistory.push({ epoch, point: { ...lastPoint } });
  //         break;
  //       } else {
  //         pointHistory.push({ epoch, point: { ...lastPoint } });
  //       }
  //     }

  //     return pointHistory;
  //   }

  //   xit('should correct save checkpoint', async () => {
  //     const value = ether('1');
  //     const unlockTime = (await time.latest()).add(days('365'));
  //     await approveAndCreateLock(people.owner, value, unlockTime);
  //     await approveAndCreateLock(alice, value, unlockTime);

  //     const epoch = await veXBE.epoch();
  //     const lastPoint = await veXBE.pointHistory(epoch);

  //     await time.increase(days(730));

  //     const result = await veXBE.checkpoint();

  //     const points = await calcCheckpoints(lastPoint, epoch, result);

  //     const newEpoch = await veXBE.epoch();

  //     // eslint-disable-next-line no-restricted-syntax
  //     for (const historyPoint of points) {
  //       const { point: expectedPoint } = historyPoint;
  //       const point = await veXBE.pointHistory(historyPoint.epoch);
  //       expect(point.bias).to.be.bignumber.equal(expectedPoint.bias);
  //       expect(point.slope).to.be.bignumber.equal(expectedPoint.slope);
  //       expect(point.ts).to.be.bignumber.equal(expectedPoint.ts);
  //       expect(point.blk).to.be.bignumber.equal(expectedPoint.blk);
  //     }
  //   });

  //   xit('should correct return last user slope', async () => {
  //     const value = ether('1');
  //     const unlockTime = (await time.latest()).add(days('7'));

  //     await approveAndCreateLock(people.owner, value, unlockTime);

  //     const slope = await veXBE.getLastUserSlope(people.owner);
  //     const uEpoch = await veXBE.userPointEpoch(people.owner);
  //     const userPointHistory = await veXBE.userPointHistory(people.owner, uEpoch);
  //     expect(slope).to.be.bignumber.equal(userPointHistory.slope);
  //   });

  //   xit('should correct return point history ts', async () => {
  //     const value = ether('1');
  //     const unlockTime = (await time.latest()).add(days('7'));

  //     await approveAndCreateLock(people.owner, value, unlockTime);

  //     const uEpoch = await veXBE.userPointEpoch(people.owner);
  //     const ts = await veXBE.userPointHistoryTs(people.owner, uEpoch);
  //     const userPointHistory = await veXBE.userPointHistory(people.owner, uEpoch);
  //     expect(ts).to.be.bignumber.equal(userPointHistory.ts);
  //   });

  //   xit('should correct change controller', async () => {
  //     await expectRevert(veXBE.changeController(alice, { from: alice }), '!controller');

  //     await veXBE.changeController(alice);
  //     const controller = await veXBE.controller();
  //     expect(controller).to.be.bignumber.equal(alice);
  //   });

  //   xit('should correct commit and apply smartWalletChecker', async () => {
  //     await veXBE.commitSmartWalletChecker(alice);

  //     const futureSmartWalletChecker = await veXBE.futureSmartWalletChecker();
  //     expect(futureSmartWalletChecker).to.be.bignumber.equal(alice);

  //     await veXBE.applySmartWalletChecker();

  //     const smartWalletChecker = await veXBE.smartWalletChecker();
  //     expect(smartWalletChecker).to.be.bignumber.equal(futureSmartWalletChecker);
  //   });
  // });
});
