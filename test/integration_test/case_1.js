/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-vars: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require('../utils/common');

const UniversalTracker = require('../utils/UniversalTracker');

const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
  months,
} = require('../utils/deploy_integration_infrastructure');

const { ZERO_ADDRESS } = constants;

function logBN(name, value) {
  console.log(`${name}: ${value}`);
}

function logBNFromWei(name, value) {
  logBN(name, web3.utils.fromWei(value, 'ether'));
}

function logBNTimestamp(name, value) {
  console.log(`${name}: ${
    new Date(value * 1000)
  }`);
}

contract('Integration tests', (accounts) => {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  const carol = accounts[3];

  let deployment;

  let contracts;

  async function deploy() {
    deployment = deployInfrastructure(owner, alice, bob, defaultParams);
    contracts = await deployment.proceed();
    Object.keys(contracts).map((key) => console.log(`${key}: ${contracts[key].address}`));
  }

  async function deployAndConfigure() {
    await deploy();
    await deployment.configure();
  }

  async function getLatestFullWeek() {
    const latestTimestamp = await time.latest();
    const WEEK = await contracts.veXBE.WEEK();
    return latestTimestamp.div(WEEK).mul(WEEK);
  }

  async function getLatestFullWeekFromBlock() {
    const latestTimestamp = await time.latest();
    const WEEK = await contracts.veXBE.WEEK();
    return latestTimestamp.div(WEEK).mul(WEEK);
  }

  async function shiftToWeeks(weeks) {
    const latestTimestamp = await time.latest();
    const WEEK = await contracts.veXBE.WEEK();
    const latestFullWeek = latestTimestamp.div(WEEK).mul(WEEK);
    const timeShift = days(7).mul(new BN(weeks)).sub(latestTimestamp.sub(latestFullWeek));
    await time.increase(timeShift);
  }

  async function getValueTrackers(account, sources) {
    const trackers = {};
    for (const source in sources) {
      if (Object.prototype.hasOwnProperty.call(sources, source)) {
        trackers[source] = await UniversalTracker(account, sources[source]);
      }
    }
    return trackers;
  }

  async function provideLiquidity(account, amount) {
    const now = await time.latest();
    await contracts.weth9.deposit({ from: account, value: amount });
    await contracts.weth9.approve(contracts.sushiSwapRouter.address, amount, { from: account });
    await contracts.mockXBE.approve(contracts.sushiSwapRouter.address, amount, { from: account });
    await contracts.sushiSwapRouter.addLiquidity(
      contracts.mockXBE.address,
      contracts.weth9.address,
      amount,
      amount,
      0,
      0,
      account,
      now.add(new BN('3600')),
      { from: account },
    );
  }

  describe('Case #1', () => {
    beforeEach(deployAndConfigure);
    it('should pass', async () => {
      const amount = ether('10');
      const inverseMaxBoostCoefficient = await contracts.votingStakingRewards
        .inverseMaxBoostCoefficient();
      const PCT_BASE = await contracts.votingStakingRewards.PCT_BASE();
      const ownerTrackers = await getValueTrackers(owner, {
        XBE: contracts.mockXBE.balanceOf,
        boost: contracts.votingStakingRewards.calculateBoostLevel,
        stakedAmount: contracts.votingStakingRewards.balanceOf,
        lockedAmount: contracts.veXBE.lockedAmount,
        votingStakingRewards: contracts.votingStakingRewards.earned,
        bonusRewards: contracts.bonusCampaign.earned,
      });

      expect(await ownerTrackers.boost.get()).to.be.bignumber.equal(
        PCT_BASE.mul(inverseMaxBoostCoefficient).div(new BN('100')),
      );

      /* ========== START BONUS CAMPAIGN ========== */
      const bonusEmission = await contracts.bonusCampaign.bonusEmission();
      const startMintReceipt = await contracts.bonusCampaign.startMint();
      expectEvent(startMintReceipt, 'RewardAdded', { reward: bonusEmission });

      /* ========== STAKE ========== */
      await contracts.mockXBE.approve(
        contracts.votingStakingRewards.address,
        amount,
        { from: owner },
      );
      const stakeReceipt = await contracts.votingStakingRewards.stake(amount, { from: owner });
      expectEvent(stakeReceipt, 'Staked', {
        user: owner,
        amount,
      });
      expect(await ownerTrackers.stakedAmount.get()).to.be.bignumber.equal(amount);
      expect(await ownerTrackers.XBE.deltaInvertedSign()).to.be.bignumber.equal(amount);
      expect(await ownerTrackers.boost.get()).to.be.bignumber.equal(
        PCT_BASE.mul(inverseMaxBoostCoefficient).div(new BN('100')),
      );

      /* ========== CREATE LOCK ========== */
      const latestFullWeek = await getLatestFullWeek();
      const lockEnd = latestFullWeek.add(months(23));
      await contracts.mockXBE.approve(
        contracts.veXBE.address,
        amount,
        { from: owner },
      );

      expect(
        await contracts.bonusCampaign.canRegister(owner),
      ).to.be.true;

      const createLockReceipt = await contracts.veXBE.createLock(amount, lockEnd);

      const ownerLockedAmount = await ownerTrackers.lockedAmount.get();
      const ownerLockEnd = await contracts.veXBE.lockedEnd(owner);

      expect(ownerLockedAmount).to.be.bignumber.equal(amount);
      expect(ownerLockEnd).to.be.bignumber.closeTo(lockEnd, days('7'));

      expect(
        await contracts.bonusCampaign.registered(owner),
      ).to.be.true;

      logBNTimestamp('rewardsDuration', await contracts.bonusCampaign.rewardsDuration());
      logBNTimestamp('periodFinish', await contracts.bonusCampaign.periodFinish());

      expect(
        await contracts.veXBE.isLockedForMax(owner),
      ).to.be.true;
      // processEventArgs(createLockReceipt, 'Staked', (args) => {
      //   expect(args.user).to.be.bignumber.equal(owner);
      //   expect(args.amount).to.be.bignumber.greaterThan(ZERO);
      // });

      expect(await ownerTrackers.boost.get()).to.be.bignumber.equal(ether('1'));

      /* ========== TRY TO WITHDRAW WITH ACTIVE LOCK ========== */
      const ownerStaked = await contracts.votingStakingRewards.balanceOf(owner);
      await expectRevert(
        contracts.votingStakingRewards.withdrawUnbonded(ownerStaked),
        'escrow amount failure',
      );

      /* ========== BONUS CAMPAIGN REWARD DISTRIBUTION ========== */

      for (let i = 0; i < 24; i += 1) {
        await time.increase(months('1'));
        const bonusRewardsDelta = await ownerTrackers.bonusRewards.delta();
        const bonusRewards = await ownerTrackers.bonusRewards.get();

        await contracts.bonusCampaign.getReward();
        const receivedBonusReward = await ownerTrackers.XBE.delta();
        const userRewards = await ownerTrackers.bonusRewards.get();

        console.group(`Now + ${i + 1} month`);
        logBNFromWei('received reward', receivedBonusReward);
        logBNFromWei('userRewards', userRewards);
        logBNFromWei('userRewards', bonusRewards);
        logBNFromWei('userRewards delta', bonusRewardsDelta);
        logBNFromWei('userBalance', await contracts.bonusCampaign.balanceOf(owner));
        logBNFromWei('totalSupply', await contracts.bonusCampaign.totalSupply());
        logBNFromWei('rewardRate', await contracts.bonusCampaign.rewardRate());
        console.groupEnd();
      }

      /* ========== BONUS CAMPAIGN REWARD CLAIM ========== */
      await ownerTrackers.XBE.get();
      await contracts.bonusCampaign.getReward();
      expect(await ownerTrackers.bonusRewards.get()).to.be.bignumber.equal(ZERO);
      const receivedBonusReward = await ownerTrackers.XBE.delta();
      logBNFromWei('received reward', receivedBonusReward);
      const userRewards = await ownerTrackers.bonusRewards.get();
      logBNFromWei('userRewards', userRewards);

      /* ========== WITHDRAW LOCKED AND STAKED ========== */
      // await time.increaseTo(ownerLockEnd.add(months('1')));
      // await contracts.veXBE.withdraw();
      // const ownerBondedRewardLocks = await contracts.votingStakingRewards.bondedRewardLocks(owner);
      // const withdrawAmount = (await ownerTrackers.stakedAmount.get())
      //   .sub(ownerBondedRewardLocks.amount);

      // await contracts.votingStakingRewards.withdrawUnbonded(withdrawAmount);

      // expect(await ownerTrackers.stakedAmount.deltaInvertedSign()).to.be.bignumber.equal(amount);
      // expect(await ownerTrackers.XBE.delta()).to.be.bignumber.equal(amount);
    });
  });
});
