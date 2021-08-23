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
const { ZERO_ADDRESS } = constants;

const common = require('./utils/common.js');
const utilsConstants = require('./utils/constants.js');
const environment = require('./utils/environment.js');
const { people, setPeople } = require('./utils/accounts.js');

let mockXBE;
let veXBE;
let treasury;
let voting;
let votingStakingRewards;
let boostLogicProvider;
let bonusCampaign;

const redeploy = async () => {
  [
    mockXBE,
    veXBE,
    bonusCampaign,
    lockSubscription,
    treasury,
    voting,
    votingStakingRewards
  ] = await environment.getGroup(
    [
      'MockXBE',
      'VeXBE',
      'Controller',
      'BonusCampaign',
      'LockSubscription',
      'Treasury',
      'Voting',
      'SushiVault',
      'Kernel',
      'ACL',
      'BaseKernel',
      'BaseACL',
      'DAOFactory',
      'EVMScriptRegistryFactory',
      'VotingStakingRewards'
    ],
    (key) => {
      return [
        "MockXBE",
        "VeXBE",
        "BonusCampaign",
        "LockSubscription",
        "Treasury",
        "Voting",
        "VotingStakingRewards"
      ].includes(key);
    },
    true,
    {
      "VotingStakingRewards": {
        8: [ ZERO_ADDRESS ]
      }
    }
  );
}

contract('VotingStakingRewards', (accounts) => {

  setPeople(accounts);

  describe('configuration and setters', () => {

    beforeEach(async () => {
      // await redeploy();
      boostLogicProvider = bonusCampaign;
    });

    xit('should configure properly', async () => {
      expect(await votingStakingRewards.rewardsToken()).to.be.equals(mockXBE.address);
      expect(await votingStakingRewards.stakingToken()).to.be.equals(mockXBE.address);
      expect(await votingStakingRewards.rewardsDistribution()).to.be.equals(treasury.address);
      expect(await votingStakingRewards.rewardsDuration()).to.be.bignumber.equals(common.days('14'));
      expect(await votingStakingRewards.token()).to.be.equals(veXBE.address);
      expect(await votingStakingRewards.voting()).to.be.equals(voting.address);
      expect(await votingStakingRewards.boostLogicProvider()).to.be.equals(boostLogicProvider.address);
      expect(await votingStakingRewards.treasury()).to.be.equals(treasury.address);
    });

    xit('should set inverse max boost coef', async () => {
      await common.checkSetter(
        'setInverseMaxBoostCoefficient',
        'inverseMaxBoostCoefficient',
        new BN('30'),
        await common.waitFor("owner", people),
        await common.waitFor("alice", people),
        votingStakingRewards,
        "!owner",
        expect,
        expectRevert
      );
    });

    xit('should set penalty pct', async () => {
      await common.checkSetter(
        'setPenaltyPct',
        'penaltyPct',
        new BN('3000'),
        await common.waitFor("owner", people),
        await common.waitFor("alice", people),
        votingStakingRewards,
        "!owner",
        expect,
        expectRevert
      );
    });

    xit('should set bonded lock duration', async () => {
      await common.checkSetter(
        'setBondedLockDuration',
        'bondedLockDuration',
        new BN('30000'),
        await common.waitFor("owner", people),
        await common.waitFor("alice", people),
        votingStakingRewards,
        "!owner",
        expect,
        expectRevert
      );
    });

    xit('should set boosting logic provider', async () => {
      await common.checkSetter(
        'setBoostLogicProvider',
        'boostLogicProvider',
        ZERO_ADDRESS,
        await common.waitFor("owner", people),
        await common.waitFor("alice", people),
        votingStakingRewards,
        "!owner",
        expect,
        expectRevert
      );
    });
  });

  describe('views', () => {

    let owner;
    const amount = ether('1');
    const duration = common.days('2');

    beforeEach(async () => {
      await redeploy();
      owner = await common.waitFor('owner', people);
      await mockXBE.approve(
        votingStakingRewards.address,
        amount,
        { from: owner }
      );
      await votingStakingRewards.stake(
        amount,
        { from: owner }
      );
      await mockXBE.approve(
        treasury.address,
        amount,
        { from: owner }
      );
      await mockXBE.transfer(
        treasury.address,
        amount,
        { from: owner }
      );
      await treasury.toVoters();
      await bonusCampaign.startMint();
    });

    xit('should get total supply', async () => {
      expect(await votingStakingRewards.totalSupply())
        .to.be.bignumber.equal(amount);
    });

    xit('should get balance of user', async () => {
      expect(await votingStakingRewards.balanceOf(owner))
        .to.be.bignumber.equal(amount);
    });

    xit('should limit last time reward applicable', async () => {
      const now = await time.latest();
      const periodFinish = await votingStakingRewards.periodFinish();
      expect(await votingStakingRewards.lastTimeRewardApplicable())
        .to.be.bignumber.equal(now);
      await time.increaseTo(common.days('1').add(periodFinish));
      expect(await votingStakingRewards.lastTimeRewardApplicable())
        .to.be.bignumber.equal(periodFinish);
    });

    xit('should get reward per token', async () => {
      const rewardPerTokenStored = await votingStakingRewards.rewardPerTokenStored();
      const lastTimeRewardApplicable = await votingStakingRewards.lastTimeRewardApplicable();
      const lastUpdateTime = await votingStakingRewards.lastUpdateTime();
      const rewardRate = await votingStakingRewards.rewardRate();
      const eth = ether('1');
      const totalSupply = await votingStakingRewards.totalSupply();

      const expected = rewardPerTokenStored.add(
        lastTimeRewardApplicable.sub(lastUpdateTime).mul(rewardRate).mul(eth).div(totalSupply)
      );

      expect(await votingStakingRewards.rewardPerToken()).to.be.bignumber.equal(expected);
    });

    xit('should get reward for duration', async () => {
      const rewardRate = await votingStakingRewards.rewardRate();
      const rewardsDuration = await votingStakingRewards.rewardsDuration();
      const expected = rewardRate.mul(rewardsDuration);
      expect(await votingStakingRewards.getRewardForDuration())
        .to.be.bignumber.equals(expected);
    });

    xit('should get potential xbe returns', async () => {
      const eth = ether('1');

      const balance = await votingStakingRewards.balanceOf(owner);
      const rewardPerTokenStored = await votingStakingRewards.rewardPerTokenStored();
      const rewardRate = await votingStakingRewards.rewardRate();
      const totalSupply = await votingStakingRewards.totalSupply();
      const userRewardPerTokenPaid = await votingStakingRewards.userRewardPerTokenPaid(owner);
      const rewards = await votingStakingRewards.rewards(owner);

      const rewardPerTokenForDuration = rewardPerTokenStored.add(
        duration.mul(rewardRate).mul(eth).div(totalSupply)
      );

      const expected = balance.mul(
        rewardPerTokenForDuration.sub(userRewardPerTokenPaid)
      ).div(eth).add(rewards);

      expect(await votingStakingRewards.potentialXbeReturns(duration, owner))
        .to.be.bignumber.equals(expected);
    });

    xit('should calculate boost level', async () => {
      const inverseMaxBoostCoefficient = await votingStakingRewards.inverseMaxBoostCoefficient();
      const minBoostLevel = inverseMaxBoostCoefficient.mul(ether('1')).div(new BN('100'));
      expect(await votingStakingRewards.calculateBoostLevel(owner))
        .to.be.bignumber.equals(minBoostLevel);
      await veXBE.createLock(amount, (await time.latest()).add(duration), { from: owner });
      expect(await votingStakingRewards.calculateBoostLevel(owner))
        .to.be.bignumber.least(minBoostLevel);
    });

    it('should calculate max boost level', async () => {
      const maxBoostLevel = await votingStakingRewards.PCT_BASE();
      console.log('max boost level', maxBoostLevel.toString());
      const configureTime = utilsConstants.localParams.bonusCampaign.configureTime;
      console.log('owner can be registered', await bonusCampaign.canRegister(owner));
      console.log('periodFinish', bonusCampaign.periodFinish() - configureTime);
      expectEvent(await veXBE.createLock(
          amount,
          (configureTime).add(common.months('23')),
          { from: owner },
        ),
        'Staked'
      );

      // expect(await bonusCampaign.registered(owner)).to.be.true;

      expect(await votingStakingRewards.calculateBoostLevel(owner))
        .to.be.bignumber.equals(maxBoostLevel);
    });

    xit('should get earned', async () => {
      const boostLevel = await votingStakingRewards.calculateBoostLevel(owner);
      console.log('boost level', boostLevel.toString());
      const balance = await votingStakingRewards.balanceOf(owner);
      const rewardPerToken = await votingStakingRewards.rewardPerToken();
      const userRewardPerTokenPaid = await votingStakingRewards.userRewardPerTokenPaid(owner);
      const rewards = await votingStakingRewards.rewards(owner);

      const maxBoostedReward = balance.mul(
        rewardPerToken.sub(userRewardPerTokenPaid)
      ).div(ether('1'));

      const expected = maxBoostedReward.mul(boostLevel).div(ether('1')).add(rewards);
      expect(await votingStakingRewards.earned(owner)).to.be.bignumber.equal(expected);
    });


  });

  describe('transfers', () => {
    // beforeEach(async () => {
    //   await redeploy();
    // });

    xit('should notify accepted reward amount', async () => {

    });

    xit('should stake', async () => {

    });

    xit('should set allowance of staker', async () => {

    });

    xit('should set strategy who can autostake', async () => {

    });

    xit('should stake for', async () => {

    });

    xit('should request withdraw bonded', async () => {

    });

    xit('should withdraw bonded or with penalty', async () => {

    });

    xit('should withdraw unbonded', async () => {

    });

    xit('should get reward', async () => {

    });
  });


});
