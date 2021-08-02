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

  async function startBonusCampaign() {
    const bonusEmission = await contracts.bonusCampaign.bonusEmission();
    const startMintReceipt = await contracts.bonusCampaign.startMint();
    expectEvent(startMintReceipt, 'RewardAdded', { reward: bonusEmission });
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

  async function logAllTrackers(trackers, groupTitle = 'Trackers') {
    console.group(groupTitle);
    logBNFromWei('alice XBE', await trackers.XBE.get());
    logBNFromWei('alice sushiLP', await trackers.sushiLP.get());
    logBNFromWei('alice sushiStaked', await trackers.sushiStaked.get());
    logBNFromWei('sushiStrategyTotalDeposited',
      await contracts.sushiStrategy.balanceOf()
    );

    logBNFromWei('sushiStrategy XBE balance', await contracts.mockXBE.balanceOf(
      contracts.sushiStrategy.address,
    ));

    logBNFromWei('sushiVault XBE balance', await contracts.mockXBE.balanceOf(
      contracts.sushiVault.address,
    ));

    logBNFromWei('alice earned in vault', await trackers.vaultEarned.get());
    logBNFromWei('rewards in VSR', await trackers.votingStakingRewards.get());
    logBNFromWei('staked in VSR', await trackers.votingStaked.get());
    logBNFromWei('urptp alice', await contracts.sushiVault.userRewardPerTokenPaid(
      contracts.mockXBE.address,
      alice,
    ));
    logBNFromWei('rpt stored', await contracts.sushiVault.rewardsPerTokensStored(
      contracts.mockXBE.address,
    ));
    logBNFromWei('alice reward', await contracts.sushiVault.userReward(
      alice, contracts.mockXBE.address
    ));

    // logBNFromWei('treasuty xbe balance', await contracts.mockXBE.balanceOf(
    //   contracts.treasury.address,
    // ));
    console.groupEnd();
  }

  describe('Case #4', () => {
    beforeEach(deployAndConfigure);
    it('should pass', async () => {
      const amount = ether('1');

      const aliceTrackers = await getValueTrackers(alice, {
        XBE: contracts.mockXBE.balanceOf,
        sushiLP: contracts.sushiLP.balanceOf,
        sushiStaked: contracts.sushiVault.balanceOf,
        votingStakingRewards: contracts.votingStakingRewards.earned,
        votingStaked: contracts.votingStakingRewards.balanceOf,
        vaultEarned: (account) => contracts.sushiVault.earned(
          contracts.mockXBE.address,
          account,
        ),

      });
      await startBonusCampaign();

      await logAllTrackers(aliceTrackers, 'Before all');

      /* ===== Provide liquidity ==== */
      await provideLiquidity(alice, amount);

      await logAllTrackers(aliceTrackers, 'After AddLiquidity');

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
      expect(await aliceTrackers.sushiStaked.delta()).to.be.bignumber.equal(lpAmountToStake);
      await logAllTrackers(aliceTrackers, 'After LP Stake');

      /* ====== EMULATE BACKEND ===== */
      await contracts.simpleXBEInflation.mintForContracts();
      await contracts.treasury.toVoters();
      await logAllTrackers(aliceTrackers, 'After mintForContracts');

      await contracts.sushiVault.earn();
      await logAllTrackers(aliceTrackers, 'After vault.earn()');

      for (let i = 0; i < 7; i += 1) {
        await time.increase(days('1'));
        await logAllTrackers(aliceTrackers, `After getReward + ${i} days`);
        await contracts.sushiVault.getReward(3, { from: alice });
      }

      await time.increase(days('14'));
      await contracts.sushiVault.getReward(3, { from: alice });
      await logAllTrackers(aliceTrackers, '+ 14 days');

      // await logAllTrackers(aliceTrackers, 'After getReward');
      // processEventArgs(getrewardReceipt, 'RewardPaid', (args) => {
      //   logBNFromWei('RewardPaid amount', args.reward);
      // });

      await time.increase(days('14'));
      await contracts.sushiVault.getReward(3, { from: alice });
      await logAllTrackers(aliceTrackers, '+14 days');

      // for (let i = 0; i < 7; i += 1) {
      //   await time.increase(days('1'));
      //   await logAllTrackers(aliceTrackers, `After getReward + ${i} days`);
      // }

      // logBNFromWei('alice reward', await contracts.sushiVault.rewards(alice, contracts.mockXBE.address));
      // console.log('get alice userReward', await contracts.sushiVault.userReward(alice, contracts.mockXBE.address));
      const getrewardReceipt = await contracts.sushiVault.getReward(3, { from: alice });
      // logBNFromWei('alice reward', await contracts.sushiVault.rewards(alice, contracts.mockXBE.address));

      await logAllTrackers(aliceTrackers, 'After getReward');
      processEventArgs(getrewardReceipt, 'RewardPaid', (args) => {
        logBNFromWei('RewardPaid amount', args.reward);
      });

      logBNFromWei('alice reward', await contracts.sushiVault.rewards(alice, contracts.mockXBE.address));

      const withdraw = await contracts.sushiVault
        .withdraw(await aliceTrackers.sushiStaked.get(), { from: alice });
      await logAllTrackers(aliceTrackers, 'After withdraw');

      const events = await contracts.votingStakingRewards.getPastEvents('Staked');

      processEventArgs(withdraw, 'RewardPaid', (args) => {
        logBNFromWei('RewardPaid amount', args.reward);
      });

      // await contracts.treasury.toVoters();
      // await logAllTrackers(aliceTrackers, 'After toVoters');
    });
  });
});
