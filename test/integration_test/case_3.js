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

  describe('Case #3', () => {
    beforeEach(deployAndConfigure);
    it('reward from simpleXBEinflation', async () => {
      const amount = ether('10');
      const PCT_BASE = await contracts.votingStakingRewards.PCT_BASE();
      const inverseMaxBoostCoefficient = await contracts.votingStakingRewards
        .inverseMaxBoostCoefficient();

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

      expect(await ownerTrackers.boost.get()).to.be.bignumber.equal(
        PCT_BASE.mul(inverseMaxBoostCoefficient).div(new BN('100')),
      );

      /* ========== MINT REWARDS AND CHECK DISTRIBUTION ========== */
      const periodDuration = await contracts.simpleXBEInflation.periodDuration();
      const targetMinted = await contracts.simpleXBEInflation.targetMinted();
      const periodicEmission = await contracts.simpleXBEInflation.periodicEmission();
      const expectTargetMinted = periodicEmission.mul(new BN('52'));
      expect(targetMinted).to.be.bignumber.closeTo(
        expectTargetMinted,
        new BN(1000),
      );

      for (let i = 0; i < 52; i += 1) {
        await mintForInflationAndSendToVoters();

        for (let j = 0; j < 7; j += 1) {
          const ownerVoterRewards = await ownerTrackers.votingStakingRewardsEarned.get();
          logBNFromWei(`[Day ${ i*7 + j + 1}] Earned after mint`, ownerVoterRewards);
          await time.increase(days('1'));
        }
      }

      // logBNFromWei('Earned after mint',
      //   await contracts.votingStakingRewards.earned(owner));
      // await time.increase(days(14));
      // logBNFromWei('Earned after 14 days',
      //   await contracts.votingStakingRewards.earned(owner));

      /* ========== UNLOCK AND UNSTAKE ========== */
      await contracts.veXBE.withdraw();
      const ownerBondedRewardLocks = await contracts.votingStakingRewards.bondedRewardLocks(owner);
      const withdrawAmount = (await ownerTrackers.stakedAmount.get())
        .sub(ownerBondedRewardLocks.amount);

      await contracts.votingStakingRewards.withdrawUnbonded(withdrawAmount);

      expect(await ownerTrackers.stakedAmount.deltaInvertedSign()).to.be.bignumber.equal(amount);
      expect(await ownerTrackers.XBE.delta()).to.be.bignumber.equal(amount);
    });
  });
});
