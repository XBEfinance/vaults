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
  async function logAllTrackers(trackers, groupTitle = '') {
    console.group(groupTitle);
    logBNFromWei('XBE', await trackers.XBE.get());
    logBNFromWei('sushiLP', await trackers.sushiLP.get());
    logBNFromWei('sushiStaked', await trackers.sushiStaked.get());
    logBNFromWei('votingStakingRewards', await trackers.votingStakingRewards.get());
    logBNFromWei('sushiStrategyTotalDeposited',
      await contracts.sushiStrategy.balanceOf());
    logBNFromWei('sushiStrategy XBE balance', await contracts.mockXBE.balanceOf(
      contracts.sushiStrategy.address,
    ));
    logBNFromWei('earned in vault', await trackers.vaultEarned.get());
    logBNFromWei('treasuty xbe balance', await contracts.mockXBE.balanceOf(
      contracts.treasury.address,
    ));
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
        vaultEarned: (account) => contracts.sushiVault.earned(
          contracts.mockXBE.address,
          account,
        ),
      });

      const receipt = await contracts.simpleXBEInflation.mintForContracts();
      const votingStakingRewardsReceipt = await contracts.treasury.toVoters();

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
      const stakingToken = await contracts.sushiVault.stakingToken();
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
      await contracts.sushiVault.earn();

      await logAllTrackers(aliceTrackers, 'After vault.earn()');

      await time.increase(days('200'));


      await logAllTrackers(aliceTrackers, 'After mintForContracts');

      const isMxbeValid = await contracts.sushiVault.isTokenValid(contracts.mockXBE.address);
      console.log('mxbe is valid ? = ', isMxbeValid);
      const earnedReal = await contracts.sushiVault.earnedReal();
      logBNFromWei('earnedReal', earnedReal[0]);
      const getreward = await contracts.sushiVault.getReward(0x02);

      await logAllTrackers(aliceTrackers, 'After getReward');

      await contracts.sushiVault.withdraw(await aliceTrackers.sushiStaked.get(), { from: alice });
      await logAllTrackers(aliceTrackers, 'After withdraw');

      // await contracts.treasury.toVoters();
      // await logAllTrackers(aliceTrackers, 'After toVoters');
    });
  });
});
