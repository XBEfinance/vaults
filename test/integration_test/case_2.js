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

  async function mintForInflationAndSendToVoters() {
    /* ========== MINT FROM INFLATION AND SEND TO VOTERS ========== */
    const receipt = await contracts.simpleXBEInflation.mintForContracts();
    const votingStakingRewardsXBETracker = await UniversalTracker(
      contracts.votingStakingRewards.address,
      contracts.mockXBE.balanceOf,
    );
    const treasuryRewardBalance = await contracts.mockXBE.balanceOf(
      contracts.treasury.address,
    );
    const votingStakingRewardsReceipt = await contracts.treasury.toVoters();
    expect(await votingStakingRewardsXBETracker.delta()).to.be.bignumber.equal(
      treasuryRewardBalance,
    );
    logBNFromWei('votingStakingRewards XBE balance', await votingStakingRewardsXBETracker.get());
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

  async function stake(from, amount) {
    await contracts.mockXBE.approve(
      contracts.votingStakingRewards.address,
      amount,
      { from },
    );
    return contracts.votingStakingRewards.stake(amount, { from });
  }

  async function createLock(from, amount, duration) {
  /* ========== CREATE LOCK ========== */
    const latestFullWeek = await getLatestFullWeek();
    const lockEnd = latestFullWeek.add(duration);
    const createLockReceipt = await contracts.veXBE.createLock(amount, lockEnd, { from });
  }

  async function startBonusCampaign() {
    const bonusEmission = await contracts.bonusCampaign.bonusEmission();
    const startMintReceipt = await contracts.bonusCampaign.startMint();
    expectEvent(startMintReceipt, 'RewardAdded', { reward: bonusEmission });
  }

  describe('Case #2', () => {
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
        votingStakingRewardsEarned: contracts.votingStakingRewards.earned,
        bonusRewards: contracts.bonusCampaign.earned,
        veXBE: contracts.veXBE.balanceOf,
      });

      await startBonusCampaign();
      const stakeReceipt = await stake(owner, amount);
      expectEvent(stakeReceipt, 'Staked', {
        user: owner,
        amount,
      });
      expect(await ownerTrackers.stakedAmount.get()).to.be.bignumber.equal(amount);
      expect(await ownerTrackers.XBE.deltaInvertedSign()).to.be.bignumber.equal(amount);
      expect(await ownerTrackers.boost.get()).to.be.bignumber.equal(
        PCT_BASE.mul(inverseMaxBoostCoefficient).div(new BN('100')),
      );

      await createLock(owner, amount, months('1'));
      const ownerLockedAmount = await ownerTrackers.lockedAmount.get();
      const ownerLockEnd = await contracts.veXBE.lockedEnd(owner);
      expect(ownerLockedAmount).to.be.bignumber.equal(amount);
      // expect(ownerLockEnd).to.be.bignumber.equal(lockEnd);

      // Stake and lock more users
      for (let i = 1; i < 3; i += 1) {
        await contracts.mockXBE.mintSender(ether('100'), { from: accounts[i] });
        await stake(accounts[i], amount);
        await createLock(accounts[i], amount, months('23'));
        expect(await contracts.veXBE.isLockedForMax(accounts[i])).to.be.true;
      }

      const votingXBEBalanceTracker = await UniversalTracker(
        contracts.votingStakingRewards.address,
        contracts.mockXBE.balanceOf,
      );

      await mintForInflationAndSendToVoters();

      // Shift to periodFinish
      await time.increase(days('7'));

      async function getReverseStakeShare(account) {
        const totalStake = await contracts.votingStakingRewards.totalSupply();
        const userStake = await contracts.votingStakingRewards.balanceOf(account);
        return totalStake.div(userStake);
      }
      logBNFromWei('CURRENT BOOST', await ownerTrackers.boost.get());
      const totalRewards = await votingXBEBalanceTracker.delta();
      const ownerStakeReverseShare = await getReverseStakeShare(owner);
      const ownerMaxReward = totalRewards.div(ownerStakeReverseShare);
      logBNFromWei('totalRewards', totalRewards);
      logBN('Owner reverse stake share', ownerStakeReverseShare);
      logBNFromWei('Owner max reward', ownerMaxReward);

      /* ========== CHECK BOOST CHANGE ========== */
      for (let i = 0; i < 23; i += 1) {
        const oldLockedEnd = await contracts.veXBE.lockedEnd(owner);
        const newLockedEnd = oldLockedEnd.add(months('1'));

        await contracts.veXBE.increaseUnlockTime(newLockedEnd);
        const totalVotingPower = await contracts.veXBE.totalSupply();
        const userVotingPower = await ownerTrackers.veXBE.get();
        const currentBoost = await ownerTrackers.boost.get();
        const earned = await ownerTrackers.votingStakingRewardsEarned.get();
        const expectedEarned = ownerMaxReward.mul(currentBoost).div(PCT_BASE);

        // expect(earned).to.be.bignumber.closeTo(
        //   expectedEarned,
        //   new BN(1e15),
        // );

        console.group(`Month ${i + 1}`);
        logBNTimestamp('oldLockedEnd', oldLockedEnd);
        logBNTimestamp('newLockedEnd', newLockedEnd);
        logBNTimestamp('actualLockedEnd', await contracts.veXBE.lockedEnd(owner));
        // logBNFromWei('Owner voting power', userVotingPower);
        // logBNFromWei('Total voting power', totalVotingPower);
        logBNFromWei('CURRENT BOOST', currentBoost);
        logBNFromWei('votingStakingRewards', earned);
        logBNFromWei('expectedEarned', expectedEarned);
        console.groupEnd();
      }

      /* ========== BONUS CAMPAIGN REWARD DISTRIBUTION ========== */
      // for (let i = 0; i < 18; i += 1) {
      //   await time.increase(months('1'));
      //   const currentTimestamp = await time.latest();
      //   const bonusRewardsDelta = await ownerTrackers.bonusRewards.delta();
      //   const bonusRewards = await ownerTrackers.bonusRewards.get();
      //   const votingStakingRewards = await ownerTrackers.rs.votingStakingRewardsEarned.get();
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
