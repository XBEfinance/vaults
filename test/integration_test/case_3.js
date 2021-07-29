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

  async function startBonusCampaign() {
    const bonusEmission = await contracts.bonusCampaign.bonusEmission();
    const startMintReceipt = await contracts.bonusCampaign.startMint();
    expectEvent(startMintReceipt, 'RewardAdded', { reward: bonusEmission });
  }

  async function mintForInflationAndSendToVoters() {
    await contracts.simpleXBEInflation.mintForContracts();
    const votingStakingRewardsXBETracker = await UniversalTracker(
      contracts.votingStakingRewards.address,
      contracts.mockXBE.balanceOf,
    );
    const treasuryRewardBalance = await contracts.mockXBE.balanceOf(
      contracts.treasury.address,
    );
    await contracts.treasury.toVoters();
    expect(await votingStakingRewardsXBETracker.delta()).to.be.bignumber
      .greaterThan(ZERO)
      .equal(treasuryRewardBalance);
    logBNFromWei('votingStakingRewards XBE balance', await votingStakingRewardsXBETracker.get());
  }

  async function stake(from, amount) {
    await contracts.mockXBE.approve(
      contracts.votingStakingRewards.address,
      amount,
      { from },
    );
    return contracts.votingStakingRewards.stake(amount, { from });
  }

  describe('Case #3', () => {
    beforeEach(deployAndConfigure);
    it('should pass', async () => {
      const amount = ether('10');
      const PCT_BASE = await contracts.votingStakingRewards.PCT_BASE();
      const inverseMaxBoostCoefficient = await contracts.votingStakingRewards
        .inverseMaxBoostCoefficient();
      const minimalBoost = PCT_BASE.mul(inverseMaxBoostCoefficient).div(new BN('100'));

      const ownerTrackers = await getValueTrackers(owner, {
        XBE: contracts.mockXBE.balanceOf,
        boost: contracts.votingStakingRewards.calculateBoostLevel,
        stakedAmount: contracts.votingStakingRewards.balanceOf,
        lockedAmount: contracts.veXBE.lockedAmount,
        votingStakingRewardsEarned: contracts.votingStakingRewards.earned,
        bonusRewards: contracts.bonusCampaign.earned,
        bonusRewardsPaid: contracts.bonusCampaign.userRewardPerTokenPaid,
      });

      await startBonusCampaign();

      await stake(owner, amount);
      await ownerTrackers.XBE.get();

      const votingStakingRewardsXBEBalance = UniversalTracker(
        contracts.votingStakingRewards.address,
        contracts.mockXBE.balanceOf,
      );
      const ownerBoost = await ownerTrackers.boost.get();
      expect(ownerBoost).to.be.bignumber.equal(minimalBoost);

      /* ========== MINT REWARDS AND CHECK DISTRIBUTION ========== */
      const periodDuration = await contracts.simpleXBEInflation.periodDuration();
      const targetMinted = await contracts.simpleXBEInflation.targetMinted();
      const periodicEmission = await contracts.simpleXBEInflation.periodicEmission();
      const expectTargetMinted = periodicEmission.mul(new BN('52'));
      expect(targetMinted).to.be.bignumber.closeTo(
        expectTargetMinted,
        new BN(1000),
      );
      logBNFromWei('periodicEmission', periodicEmission);

      const votingXBEBalanceTracker = await UniversalTracker(
        contracts.votingStakingRewards.address,
        contracts.mockXBE.balanceOf,
      );
      let totalEarned = ZERO;
      for (let i = 0; i < 52; i += 1) {
        await mintForInflationAndSendToVoters();
        const maxDailyReward = (await votingXBEBalanceTracker.delta()).div(new BN('7'));
        logBNFromWei('maxDailyReward', maxDailyReward);

        for (let j = 0; j < 7; j += 1) {
          await time.increase(days('1'));
          const earnedRewards = await ownerTrackers.votingStakingRewardsEarned.delta();
          const ownerVotingRewards = await ownerTrackers.votingStakingRewardsEarned.get();
          console.group(`[Day ${i * 7 + j + 1}]`);
          logBNFromWei('Earned since last check', earnedRewards);
          logBNFromWei('Total earned', ownerVotingRewards);
          console.groupEnd();
          totalEarned = totalEarned.add(earnedRewards);
          expect(earnedRewards).to.be.bignumber.closeTo(
            maxDailyReward.mul(ownerBoost).div(PCT_BASE),
            new BN(1e15),
          );
        }
      }

      logBNFromWei('Total rewards expected', totalEarned);
      const getRewardReceipt = await contracts.votingStakingRewards.getReward();
      processEventArgs(getRewardReceipt, 'RewardPaid', (args) => {
        expect(args.user).to.be.bignumber.equal(owner);
        logBNFromWei('Paid reward amount', args.reward);
        expect(args.reward).to.be.bignumber.equal(totalEarned);
      });

      /* ========== UNLOCK AND UNSTAKE ========== */
      const ownerBondedRewardLocks = await contracts.votingStakingRewards.bondedRewardLocks(owner);
      const withdrawAmount = (await ownerTrackers.stakedAmount.get())
        .sub(ownerBondedRewardLocks.amount);
      await ownerTrackers.XBE.get();

      logBNTimestamp('ownerBondedRewardLocks.unlockTime', ownerBondedRewardLocks.unlockTime);
      logBNFromWei('ownerBondedRewardLocks.amount', ownerBondedRewardLocks.amount);
      logBNFromWei('withdrawAmount', withdrawAmount);

      await contracts.votingStakingRewards.withdrawUnbonded(withdrawAmount);

      expect(await ownerTrackers.stakedAmount.deltaInvertedSign()).to.be.bignumber.equal(amount);
      expect(await ownerTrackers.XBE.delta()).to.be.bignumber.equal(amount);
    });
  });
});
