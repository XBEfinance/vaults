/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require("chai");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require("@openzeppelin/test-helpers");
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require("./utils/common.js");
const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
  beforeEachWithSpecificDeploymentParams
} = require("./utils/deploy_infrastructure.js");


const { ZERO_ADDRESS } = constants;
const MockContract = artifacts.require("MockContract");

contract("StakingRewards", (accounts) => {

  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let mockXBE;
  let mockCRV;
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let stakingRewards;
  let vaultWithXBExCRVStrategy;

  let deployment;

  describe('with proper configuration', () => {

    beforeEach(async () => {
      [
        vaultWithXBExCRVStrategy,
        mockXBE,
        mockCRV,
        xbeInflation,
        bonusCampaign,
        veXBE,
        voting,
        stakingRewards
      ] = await beforeEachWithSpecificDeploymentParams(owner, alice, bob);
    });

    it('should configure properly', async () => {
      expect(await stakingRewards.rewardsToken()).to.be.equal(
        mockCRV.address
      );
      expect(await stakingRewards.stakingToken()).to.be.equal(
        defaultParams.vaultWithXBExCRVStrategyAddress
      );
      expect(await stakingRewards.rewardsDistribution()).to.be.equal(
        owner
      );
      expect(await stakingRewards.rewardsDuration()).to.be.bignumber.equal(
        defaultParams.liquidityGaugeReward.rewardsDuration
      );
    });

    it('should return totalSupply', async () => {
      const amount = ether('100');
      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);
      expect(await stakingRewards.totalSupply()).to.be.bignumber.equal(amount);
    });

    it('should return balance of user', async () => {
      const amount = ether('100');
      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);
      expect(await stakingRewards.balanceOf(owner)).to.be.bignumber.equal(amount);
    });

    it('should return last time reward applicable', async () => {
      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      await stakingRewards.notifyRewardAmount(mockTotalSupply);

      const currentTime = await time.latest();

      let lastTimeRewardApplicable = await stakingRewards.lastTimeRewardApplicable();
      expect(lastTimeRewardApplicable).to.be.bignumber.equal(currentTime);

      await time.increase(
        (await stakingRewards.rewardsDuration()).add(days('1'))
      );

      lastTimeRewardApplicable = await stakingRewards.lastTimeRewardApplicable();
      expect(lastTimeRewardApplicable).to.be.bignumber.equal(
        await stakingRewards.periodFinish()
      );

    });

    it('should return reward per token', async () => {

      let rewardsPerTokenStored = await stakingRewards.rewardPerTokenStored();

      expect(await stakingRewards.rewardPerToken()).to.be.bignumber.equal(
        rewardsPerTokenStored
      );

      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      await stakingRewards.notifyRewardAmount(mockTotalSupply);

      const amount = ether('100');
      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);

      rewardsPerTokenStored = await stakingRewards.rewardPerTokenStored();
      const lastTimeRewardApplicable = await stakingRewards.lastTimeRewardApplicable();
      const lastUpdateTime = await stakingRewards.lastUpdateTime();
      const rewardRate = await stakingRewards.rewardRate();

      const expected = rewardsPerTokenStored.add(
        lastTimeRewardApplicable.sub(lastUpdateTime).mul(rewardRate).mul(MULTIPLIER).div(mockTotalSupply)
      );

      expect(await stakingRewards.rewardPerToken()).to.be.bignumber.equal(
        expected
      );

    });

    it('should return earned amount', async () => {
      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      await stakingRewards.notifyRewardAmount(mockTotalSupply);

      const amount = ether('100');
      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);

      await time.increase(days('20'));

      const balanceOfOwner = await stakingRewards.balanceOf(owner);
      const rewardPerToken = await stakingRewards.rewardPerToken();
      const userRewardPerTokenPaid = await stakingRewards.userRewardPerTokenPaid(owner);
      const ownerRewards = await stakingRewards.rewards(owner);

      const expected = balanceOfOwner.mul(
        rewardPerToken.sub(userRewardPerTokenPaid)
      ).div(MULTIPLIER).add(ownerRewards);

      expect(await stakingRewards.earned(owner)).to.be.bignumber.equal(expected);
    });

    it('should return reward for duration', async () => {
      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      await stakingRewards.notifyRewardAmount(mockTotalSupply);

      const expected = (await stakingRewards.rewardRate())
        .mul(await stakingRewards.rewardsDuration());

      expect(await stakingRewards.getRewardForDuration()).to.be.bignumber
        .equal(expected);

    });

    it('should stake', async () => {
      await expectRevert(stakingRewards.stake(ZERO), "Cannot stake 0");
      const amount = ether('100');
      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      const result = await stakingRewards.stake(amount);
      expectEvent(result, "Staked", {
        user: owner,
        amount: amount
      });
      expect(await stakingRewards.balanceOf(owner)).to.be.bignumber.equal(amount);
    });

    it('should withdraw', async () => {
      await expectRevert(stakingRewards.withdraw(ZERO), "Cannot withdraw 0");
      const amount = ether('100');
      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);
      const result = await stakingRewards.withdraw(amount);
      expectEvent(result, "Withdrawn", {
        user: owner,
        amount: amount
      });
      expect(await stakingRewards.balanceOf(owner)).to.be.bignumber.equal(ZERO);
    });

    it('should get reward', async () => {
      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      await stakingRewards.notifyRewardAmount(mockTotalSupply);

      const amount = ether('50');

      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);

      await time.increase(days('10'));

      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);

      await time.increase(days('10'));

      const reward = await stakingRewards.earned(owner);
      expect(reward).to.be.bignumber.above(ZERO);
      const result = await stakingRewards.getReward();
      expectEvent(result, "RewardPaid", {
        user: owner,
        reward: reward
      });

    });

    it('should perform exit', async () => {
      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      await stakingRewards.notifyRewardAmount(mockTotalSupply);

      const amount = ether('50');

      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);

      await time.increase(days('10'));

      await vaultWithXBExCRVStrategy.approve(stakingRewards.address, amount);
      await stakingRewards.stake(amount);

      await time.increase(days('10'));

      const reward = await stakingRewards.earned(owner);
      expect(reward).to.be.bignumber.above(ZERO);

      const result = await stakingRewards.exit();

      expectEvent(result, "Withdrawn", {
        user: owner,
        amount: amount.mul(new BN('2'))
      });

      expectEvent(result, "RewardPaid", {
        user: owner,
        reward: reward
      });

    });

    it('should notify reward amount', async () => {
      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      const result = await stakingRewards.notifyRewardAmount(mockTotalSupply);

      expect(
        await mockCRV.balanceOf(stakingRewards.address)
      ).to.be.bignumber.equal(mockTotalSupply);

      expectEvent(result, "RewardAdded", {
        reward: mockTotalSupply
      });

    });

    it('should update period finish', async () => {
      await expectRevert(stakingRewards.updatePeriodFinish(ZERO, {from: alice}),
        "Revert (message: Ownable: caller is not the owner)");
      const updateTimestamp = (await stakingRewards.periodFinish()).add(days('2'));
      await stakingRewards.updatePeriodFinish(
        updateTimestamp
      );
      expect(await stakingRewards.periodFinish()).to.be.bignumber.equal(updateTimestamp);
    });

    it('should recover erc20', async () => {
      const amount = ether('10');
      const totalSupply = ether('100');
      let mockToken = await getMockTokenPrepared(
        alice,
        amount,
        totalSupply,
        owner
      );
      await mockToken.approve(stakingRewards.address, amount, {from: alice});
      await mockToken.transfer(stakingRewards.address, amount, {from: alice});

      await expectRevert(stakingRewards.recoverERC20(mockToken.address, amount, {from: alice}),
        "Revert (message: Ownable: caller is not the owner)")
      await expectRevert(stakingRewards.recoverERC20(vaultWithXBExCRVStrategy.address, amount),
        "Cannot withdraw the staking token")

      const result = await stakingRewards.recoverERC20(mockToken.address, amount);

      expect(await mockToken.balanceOf(owner)).to.be.bignumber.equal(
        totalSupply
      );
      expectEvent(result, "Recovered", {
        token: mockToken.address,
        amount: amount
      });
    });

    it('should set rewards duration', async () => {

      const mockTotalSupply = ether('100');
      await mockCRV.approve(stakingRewards.address, mockTotalSupply);
      await mockCRV.transfer(stakingRewards.address, mockTotalSupply);
      await stakingRewards.notifyRewardAmount(mockTotalSupply);

      await expectRevert(
        stakingRewards.setRewardsDuration(ZERO, {from: alice}),
        "Revert (message: Ownable: caller is not the owner)"
      )

      await expectRevert(
        stakingRewards.setRewardsDuration(ZERO),
        "Previous rewards period must be complete before changing the duration for the new period"
      );

      const periodFinish = await stakingRewards.periodFinish();
      const expectPeriodFinish = periodFinish.div(new BN('2'));

      await time.increaseTo(periodFinish.add(days('2')));

      const result = await stakingRewards.setRewardsDuration(expectPeriodFinish);
      expect(await stakingRewards.rewardsDuration()).to.be.bignumber.equal(expectPeriodFinish);
      expectEvent(result, "RewardsDurationUpdated",  {
        newDuration: expectPeriodFinish
      });
    });
  });
});
