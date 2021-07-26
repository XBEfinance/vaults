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

      const aliceTrackers = await getValueTrackers(alice, {
        XBE: contracts.mockXBE.balanceOf,
        sushiLP: contracts.sushiLP.balanceOf,
        sushiStaked: contracts.sushiVault.balanceOf,
        votingStakingRewards: contracts.votingStakingRewards.earned,
      });

      /* ===== Provide liquidity to XBE/WETH ==== */
      logBNFromWei('Alice XBE', await aliceTrackers.XBE.get());
      logBNFromWei('tSupply', await contracts.sushiLP.totalSupply());
      await provideLiquidity(alice, amount);
      const aliceLP = await aliceTrackers.sushiLP.get();
      const tl = await contracts.sushiLP.totalSupply();
      logBNFromWei('alicelp', aliceLP);
      logBNFromWei('tl', await contracts.sushiLP.totalSupply());

      /* ====== Stake LP tokens ===== */
      const lpAmountToStake = await aliceTrackers.sushiLP.get();
      await contracts.sushiLP.approve(
        contracts.sushiVault.address,
        lpAmountToStake,
        { from: alice },
      );
      const sushiStakeReceipt = await contracts.sushiVault.deposit(
        lpAmountToStake,
        { from: alice },
      );
      expectEvent(sushiStakeReceipt, 'Staked', {
        user: alice,
        amount: lpAmountToStake,
      });
      logBNFromWei('aliceLPStaked', await aliceTrackers.sushiStaked.get());

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
      const lockEnd = latestFullWeek.add(months('1'));
      // await contracts.mockXBE.approve(
      //   contracts.veXBE.address,
      //   amount,
      //   { from: owner },
      // );
      const createLockReceipt = await contracts.veXBE.createLock(amount, lockEnd);

      const ownerLockedAmount = await ownerTrackers.lockedAmount.get();
      const ownerLockEnd = await contracts.veXBE.lockedEnd(owner);

      expect(ownerLockedAmount).to.be.bignumber.equal(amount);
      // expect(ownerLockEnd).to.be.bignumber.equal(lockEnd);

      /* ========== START BONUS CAMPAIGN ========== */
      const bonusEmission = await contracts.bonusCampaign.bonusEmission();
      const startMintReceipt = await contracts.bonusCampaign.startMint();
      expectEvent(startMintReceipt, 'RewardAdded', { reward: bonusEmission });

      /* ========== CHECK BOOST CHANGE ========== */
      for (let i = 0; i < 6; i += 1) {
        const oldLockedEnd = await contracts.veXBE.lockedEnd(owner);
        const newLockedEnd = oldLockedEnd.add(months('1'));

        await contracts.veXBE.increaseUnlockTime(newLockedEnd);
        const currentBoost = await ownerTrackers.boost.get();
        const earned = await ownerTrackers.votingStakingRewards.get();
        console.group(`Month ${i + 1}`);
        logBNTimestamp('oldLockedEnd', oldLockedEnd);
        logBNTimestamp('newLockedEnd', newLockedEnd);
        logBNTimestamp('actualLockedEnd', await contracts.veXBE.lockedEnd(owner));
        logBNFromWei('votingStakingRewards', earned);
        logBNFromWei('CURRENT BOOST', currentBoost);
        console.groupEnd();
      }

      /* ========== BONUS CAMPAIGN REWARD DISTRIBUTION ========== */
      // for (let i = 0; i < 18; i += 1) {
      //   await time.increase(months('1'));
      //   const currentTimestamp = await time.latest();
      //   const bonusRewardsDelta = await ownerTrackers.bonusRewards.delta();
      //   const bonusRewards = await ownerTrackers.bonusRewards.get();
      //   const votingStakingRewards = await ownerTrackers.votingStakingRewards.get();
      //   const sushiVaultReward = await contracts.sushiVault
      //     .earned(contracts.mockXBE.address, alice);

      //   if (i === 12) {
      //     contracts.xbeInflation.mintForContracts();
      //   }

      //   console.group(`${i + 1} month [${currentTimestamp}]`);
      //   logBNFromWei('aliceSushiReward', sushiVaultReward);
      //   logBNFromWei('userRewards', bonusRewards);
      //   logBNFromWei('userRewards delta', bonusRewardsDelta);
      //   logBNFromWei('votingStakingRewards', votingStakingRewards);
      //   console.groupEnd();
      // }

      /* ========== BONUS CAMPAIGN REWARD CLAIM ========== */
      // await ownerTrackers.XBE.get();
      // await contracts.bonusCampaign.getReward();
      // expect(await ownerTrackers.bonusRewards.get()).to.be.bignumber.equal(ZERO);
      // const receivedBonusReward = await ownerTrackers.XBE.delta();
      // logBNFromWei('received reward', receivedBonusReward);
      // const userRewards = await ownerTrackers.bonusRewards.get();
      // logBNFromWei('userRewards', userRewards);

      /* ========== WITHDRAW LOCKED AND STAKED ========== */
      //   await time.increaseTo(ownerLockEnd.add(months('1')));
      //   await contracts.veXBE.withdraw();
      //   const ownerBondedRewardLocks = await contracts.votingStakingRewards.bondedRewardLocks(owner);
      //   const withdrawAmount = (await ownerTrackers.stakedAmount.get())
      //     .sub(ownerBondedRewardLocks.amount);

      //   await contracts.votingStakingRewards.withdrawUnbonded(withdrawAmount);

    //   expect(await ownerTrackers.stakedAmount.deltaInvertedSign()).to.be.bignumber.equal(amount);
    //   expect(await ownerTrackers.XBE.delta()).to.be.bignumber.equal(amount);
    });
  });
});
