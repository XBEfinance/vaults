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
} = require('../utils/old/common');

const UniversalTracker = require('../utils/old/UniversalTracker');

const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
  months,
} = require('../utils/old/deploy_integration_infrastructure');

const { ZERO_ADDRESS } = constants;

const ether10 = ether('10');
const ether5 = ether('5');
let PCT_BASE;
let inverseMaxBoostCoefficient;

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

  async function getConstants() {
    inverseMaxBoostCoefficient = await contracts.votingStakingRewards.inverseMaxBoostCoefficient();
    PCT_BASE = await contracts.votingStakingRewards.PCT_BASE();
    expect(PCT_BASE).not.to.be.undefined;
    expect(inverseMaxBoostCoefficient).not.to.be.undefined;
  }

  async function deployAndConfigure() {
    await deploy();
    await deployment.configure();
    await getConstants();
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
    console.log('mockXBE', contracts.mockXBE.address);
    console.log('from', from);
    console.log('amount', amount);
    console.log('votingStakingRewards', contracts.votingStakingRewards.address);

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
    await contracts.veXBE.createLock(amount, lockEnd, { from });
  }

  async function startBonusCampaign() {
    const bonusEmission = await contracts.bonusCampaign.bonusEmission();
    const startMintReceipt = await contracts.bonusCampaign.startMint();
    expectEvent(startMintReceipt, 'RewardAdded', { reward: bonusEmission });
  }

  describe('Case #2', () => {
    beforeEach(deployAndConfigure);

    it('should pass', async () => {
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
      
      const stakeReceipt = await stake(owner, ether10);
      
      expectEvent(stakeReceipt, 'Staked', {
        user: owner,
        amount: ether10,
      });

      expect(await ownerTrackers.stakedAmount.get())
        .to.be.bignumber.equal(ether10);

      expect(await ownerTrackers.XBE.deltaInvertedSign())
        .to.be.bignumber.equal(ether10);

      console.log('constants', PCT_BASE, inverseMaxBoostCoefficient)

      expect(await ownerTrackers.boost.get())
        .to.be.bignumber.equal(
          PCT_BASE
            .mul(inverseMaxBoostCoefficient)
            .div(new BN('100')),
        );

      // ownwer (account_0 locks funds not for max, first for 40 days
      // and then increases the lock duration to see how it affects boost level
      await createLock(owner, ether10, days('40'));

      const ownerLockedAmount = await ownerTrackers.lockedAmount.get();
      const ownerLockEnd = await contracts.veXBE.lockedEnd(owner);

      expect(ownerLockedAmount).to.be.bignumber.equal(ether10);
      // expect(ownerLockEnd).to.be.bignumber.equal(lockEnd);

      // Stake and lock more users
      for (let i = 1; i < 4; i += 1) {
        await contracts.mockXBE.mintSender(ether('100'), { from: accounts[i] });
        await stake(accounts[i], ether10); // all accounts stake 100 XBE
        // account_3 lock 50 XBE, 1&2 lock 100 XBE
        const lockAmount = i < 3 ? ether10: new BN(ether10).div(new BN('2'));
        const lockDuration = i === 2 ? months('5') : months('23');
        await createLock(accounts[i], lockAmount, lockDuration);
        // all accounts 1-3 lock their funds for full term
        const hasMaxBoostLevel =
          await contracts.bonusCampaign.hasMaxBoostLevel(accounts[i]);

        console.log(i.toString(), 'is max bl', hasMaxBoostLevel);
        if (i !== 2) {
          expect(hasMaxBoostLevel).to.be.true;
        } else {
          expect(hasMaxBoostLevel).to.be.false;
        }
      }

      for (let i = 0; i < 4; i += 1) {
        let deltaTime =
          new BN(await contracts.veXBE.lockedEnd(accounts[i]))
          - new BN(await contracts.veXBE.lockStarts(accounts[i]));
        console.log(
          `user[${i}] registered`, await contracts.bonusCampaign.registered(accounts[i]),
          'lock time:', deltaTime/months('1'),
        );
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
      for (let i = 0; i < 11; i += 1) {
        const oldLockedEnd = await contracts.veXBE.lockedEnd(owner);
        const newLockedEnd = oldLockedEnd.add(days('60'));

        await contracts.veXBE.increaseUnlockTime(newLockedEnd, { from: owner });
        const totalVotingPower = await contracts.veXBE.totalSupply();
        const userVotingPower = await ownerTrackers.veXBE.get();
        const currentBoost = await ownerTrackers.boost.get();
        const earned = await ownerTrackers.votingStakingRewardsEarned.get();
        const expectedEarned = ownerMaxReward.mul(currentBoost).div(PCT_BASE);
        const bal = await contracts.votingStakingRewards.balanceOf(owner);

        const rpt = await contracts.votingStakingRewards.rewardPerToken();
        const urptp = await contracts.votingStakingRewards.userRewardPerTokenPaid(owner);
        const rewards = await contracts.votingStakingRewards.rewards(owner);
        const acc1bl = await contracts.votingStakingRewards.calculateBoostLevel(accounts[1]);
        const acc2bl = await contracts.votingStakingRewards.calculateBoostLevel(accounts[2]);
        const acc3bl = await contracts.votingStakingRewards.calculateBoostLevel(accounts[3]);
        const treasuryBalance = await contracts.mockXBE.balanceOf(await contracts.treasury.address);


        // expect(earned).to.be.bignumber.closeTo(
        //   expectedEarned,
        //   new BN(1e15),
        // );

        console.group(`Month ${i + 1}`);
        logBN('balance = ', bal);
        logBN('rpt = ', rpt);
        logBN('urptp = ', urptp);
        logBN('rewards = ', rewards);

        logBNTimestamp('oldLockedEnd', oldLockedEnd);
        logBNTimestamp('newLockedEnd', newLockedEnd);
        logBNTimestamp('actualLockedEnd', await contracts.veXBE.lockedEnd(owner));
        logBNFromWei('Owner voting power', userVotingPower);
        logBNFromWei('Total voting power', totalVotingPower);
        logBNFromWei('owner BOOST', currentBoost);
        logBNFromWei('acc1 BOOST', acc1bl);
        logBNFromWei('acc2 BOOST', acc2bl);
        logBNFromWei('acc3 BOOST', acc3bl);
        logBNFromWei('votingStakingRewards', earned);
        logBNFromWei('expectedEarned', expectedEarned);
        const ownerEarned = new BN(await contracts.votingStakingRewards.earned(owner));
        logBN('earned owner', ownerEarned);
        const ownerEarnedExpected =
          bal.mul(rpt.sub(urptp))
            .div(PCT_BASE).mul(currentBoost).div(PCT_BASE)
            .add(rewards);
        logBN('earned owner check in js', ownerEarnedExpected);
        expect(ownerEarned.toString())
          .to.be.bignumber
          .closeTo(ownerEarnedExpected.toString(), new BN(1e15));
        logBN('earned account_1', await contracts.votingStakingRewards.earned(accounts[1]));
        logBNFromWei('treasury balance', treasuryBalance);
        await contracts.votingStakingRewards.getReward({ from: owner });
        await contracts.votingStakingRewards.getReward({ from: accounts[3] });

        console.groupEnd();
        await time.increase(months('1'));
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

    //   expect(await ownerTrackers.stakedAmount.deltaInvertedSign()).to.be.bignumber.equal(ether10);
    //   expect(await ownerTrackers.XBE.delta()).to.be.bignumber.equal(ether10);
    });

    it ('check register bonus campaign', async () => {
      for (let i = 1; i < 4; i += 1) {
        await contracts.mockXBE.mintSender(ether('100'), { from: accounts[i] });
        await stake(accounts[i], ether10); // all accounts stake 100 XBE
        // account_3 lock 50 XBE, 1&2 lock 100 XBE
        const lockAmount = i < 3 ? ether10: ether5;
        const lockDuration = i === 2 ? months('5') : months('23');
        console.log('lock', accounts[i], lockAmount.toString(), lockDuration.toString());
        await createLock(accounts[i], lockAmount, lockDuration);
      }

      for (let i = 0; i < 4; i += 1) {
        let deltaTime =
          new BN(await contracts.veXBE.lockedEnd(accounts[i]))
          - new BN(await contracts.veXBE.lockStarts(accounts[i]));

        const isMaxBoostLevel = await contracts.bonusCampaign.hasMaxBoostLevel(accounts[i]);
        const isRegistered = await contracts.bonusCampaign.registered(accounts[i]);
        console.log(
          `user[${i}] registered`, isRegistered,
          'lock time:', deltaTime/months('1'),
          'isMaxBoost:', isMaxBoostLevel,
        );
        if (i % 2 === 1) {
          expect(isRegistered).to.be.true;
          expect(isMaxBoostLevel).to.be.true;
        } else {
          expect(isRegistered).to.be.false;
          expect(isMaxBoostLevel).to.be.false;
        }
      }

      await startBonusCampaign();

      const periodFinish = await contracts.bonusCampaign.periodFinish();
      const now = await time.latest();
      await time.increase(periodFinish - now + days('1'));

      // bonus campaign has finished
      for (let i = 0; i < 4; i += 1) {
        const isMaxBoostLevel = await contracts.bonusCampaign.hasMaxBoostLevel(accounts[i]);
        // normal boost after campaign has finished
        if (i % 2 === 1) {
          expect(isMaxBoostLevel).to.be.false;
        } else {
          expect(isMaxBoostLevel).to.be.false;
        }
      }
    });
  });
});
