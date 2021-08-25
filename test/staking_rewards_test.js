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
} = require("./utils/old/common");
const { people, setPeople } = require('./utils/accounts');

const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
  beforeEachWithSpecificDeploymentParams,
} = require("./utils/old/deploy_strategy_infrastructure");

let mockXBE;
let mockCX;
let xbeInflation;
let bonusCampaign;
let veXBE;
let voting;
let vaultWithXBExCXStrategy;

contract('StakingRewards', (accounts) => {
  setPeople(accounts);

  beforeEach(async () => {
    [
      vaultWithXBExCXStrategy,
      mockXBE,
      mockCX,
      xbeInflation,
      bonusCampaign,
      veXBE,
      voting,
    ] = await beforeEachWithSpecificDeploymentParams(people.owner, people.alice, people.bob, people.charlie);
  });

  it('should configure properly', async () => {
    expect(await stakingRewards.rewardsToken()).to.be.equal(
      mockCX.address,
    );
    expect(await stakingRewards.stakingToken()).to.be.equal(
      defaultParams.vaultWithXBExCXStrategyAddress,
    );
    expect(await stakingRewards.rewardsDistribution()).to.be.equal(
      people.owner,
    );
    expect(await stakingRewards.rewardsDuration()).to.be.bignumber.equal(
      defaultParams.liquidityGaugeReward.rewardsDuration,
    );
  });

  it('should return totalSupply', async () => {
    const amount = ether('100');
    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);
    expect(await stakingRewards.totalSupply()).to.be.bignumber.equal(amount);
  });

  it('should return balance of user', async () => {
    const amount = ether('100');
    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);
    expect(await stakingRewards.balanceOf(people.owner)).to.be.bignumber.equal(amount);
  });

  it('should return last time reward applicable', async () => {
    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    await stakingRewards.notifyRewardAmount(mockTotalSupply);

    const currentTime = await time.latest();

    let lastTimeRewardApplicable = await stakingRewards.lastTimeRewardApplicable();
    expect(lastTimeRewardApplicable).to.be.bignumber.equal(currentTime);

    await time.increase(
      (await stakingRewards.rewardsDuration()).add(days('1')),
    );

    lastTimeRewardApplicable = await stakingRewards.lastTimeRewardApplicable();
    expect(lastTimeRewardApplicable).to.be.bignumber.equal(
      await stakingRewards.periodFinish(),
    );

  });

  it('should return reward per token', async () => {

    let rewardsPerTokenStored = await stakingRewards.rewardPerTokenStored();

    expect(await stakingRewards.rewardPerToken()).to.be.bignumber.equal(
      rewardsPerTokenStored,
    );

    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    await stakingRewards.notifyRewardAmount(mockTotalSupply);

    const amount = ether('100');
    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);

    rewardsPerTokenStored = await stakingRewards.rewardPerTokenStored();
    const lastTimeRewardApplicable = await stakingRewards.lastTimeRewardApplicable();
    const lastUpdateTime = await stakingRewards.lastUpdateTime();
    const rewardRate = await stakingRewards.rewardRate();

    const expected = rewardsPerTokenStored.add(
      lastTimeRewardApplicable.sub(lastUpdateTime).mul(rewardRate).mul(MULTIPLIER).div(mockTotalSupply),
    );

    expect(await stakingRewards.rewardPerToken()).to.be.bignumber.equal(
      expected,
    );

  });

  it('should return earned amount', async () => {
    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    await stakingRewards.notifyRewardAmount(mockTotalSupply);

    const amount = ether('100');
    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);

    await time.increase(days('20'));

    const balanceOfOwner = await stakingRewards.balanceOf(people.owner);
    const rewardPerToken = await stakingRewards.rewardPerToken();
    const userRewardPerTokenPaid = await stakingRewards.userRewardPerTokenPaid(people.owner);
    const ownerRewards = await stakingRewards.rewards(people.owner);

    const expected = balanceOfOwner.mul(
      rewardPerToken.sub(userRewardPerTokenPaid),
    ).div(MULTIPLIER).add(ownerRewards);

    expect(await stakingRewards.earned(people.owner)).to.be.bignumber.equal(expected);
  });

  it('should return reward for duration', async () => {
    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    await stakingRewards.notifyRewardAmount(mockTotalSupply);

    const expected = (await stakingRewards.rewardRate())
      .mul(await stakingRewards.rewardsDuration());

    expect(await stakingRewards.getRewardForDuration()).to.be.bignumber
      .equal(expected);

  });

  it('should stake', async () => {
    await expectRevert(stakingRewards.stake(ZERO), "Cannot stake 0");
    const amount = ether('100');
    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    const result = await stakingRewards.stake(amount);
    expectEvent(result, "Staked", {
      user: people.owner,
      amount: amount,
    });
    expect(await stakingRewards.balanceOf(people.owner)).to.be.bignumber.equal(amount);
  });

  it('should withdraw', async () => {
    await expectRevert(stakingRewards.withdraw(ZERO), "Cannot withdraw 0");
    const amount = ether('100');
    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);
    const result = await stakingRewards.withdraw(amount);
    expectEvent(result, "Withdrawn", {
      user: people.owner,
      amount: amount,
    });
    expect(await stakingRewards.balanceOf(people.owner)).to.be.bignumber.equal(ZERO);
  });

  it('should get reward', async () => {
    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    await stakingRewards.notifyRewardAmount(mockTotalSupply);

    const amount = ether('50');

    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);

    await time.increase(days('10'));

    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);

    await time.increase(days('10'));

    const reward = await stakingRewards.earned(people.owner);
    expect(reward).to.be.bignumber.above(ZERO);
    const result = await stakingRewards.getReward();
    expectEvent(result, "RewardPaid", {
      user: people.owner,
      reward: reward,
    });

  });

  it('should perform exit', async () => {
    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    await stakingRewards.notifyRewardAmount(mockTotalSupply);

    const amount = ether('50');

    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);

    await time.increase(days('10'));

    await vaultWithXBExCXStrategy.approve(stakingRewards.address, amount);
    await stakingRewards.stake(amount);

    await time.increase(days('10'));

    const reward = await stakingRewards.earned(people.owner);
    expect(reward).to.be.bignumber.above(ZERO);

    const result = await stakingRewards.exit();

    expectEvent(result, "Withdrawn", {
      user: people.owner,
      amount: amount.mul(new BN('2')),
    });

    expectEvent(result, "RewardPaid", {
      user: people.owner,
      reward: reward,
    });

  });

  it('should notify reward amount', async () => {
    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    const result = await stakingRewards.notifyRewardAmount(mockTotalSupply);

    expect(
      await mockCX.balanceOf(stakingRewards.address),
    ).to.be.bignumber.equal(mockTotalSupply);

    expectEvent(result, "RewardAdded", {
      reward: mockTotalSupply,
    });

  });

  it('should update period finish', async () => {
    await expectRevert(stakingRewards.updatePeriodFinish(ZERO, { from: people.alice }),
      "Revert (message: Ownable: caller is not the people.owner)");
    const updateTimestamp = (await stakingRewards.periodFinish()).add(days('2'));
    await stakingRewards.updatePeriodFinish(
      updateTimestamp,
    );
    expect(await stakingRewards.periodFinish()).to.be.bignumber.equal(updateTimestamp);
  });

  it('should recover erc20', async () => {
    const amount = ether('10');
    const totalSupply = ether('100');
    let mockToken = await getMockTokenPrepared(
      people.alice,
      amount,
      totalSupply,
      people.owner,
    );
    await mockToken.approve(stakingRewards.address, amount, { from: people.alice });
    await mockToken.transfer(stakingRewards.address, amount, { from: people.alice });

    await expectRevert(stakingRewards.recoverERC20(mockToken.address, amount, { from: people.alice }),
      "Revert (message: Ownable: caller is not the people.owner)")
    await expectRevert(stakingRewards.recoverERC20(vaultWithXBExCXStrategy.address, amount),
      "Cannot withdraw the staking token")

    const result = await stakingRewards.recoverERC20(mockToken.address, amount);

    expect(await mockToken.balanceOf(people.owner)).to.be.bignumber.equal(
      totalSupply,
    );
    expectEvent(result, "Recovered", {
      token: mockToken.address,
      amount: amount,
    });
  });

  it('should set rewards duration', async () => {

    const mockTotalSupply = ether('100');
    await mockCX.approve(stakingRewards.address, mockTotalSupply);
    await mockCX.transfer(stakingRewards.address, mockTotalSupply);
    await stakingRewards.notifyRewardAmount(mockTotalSupply);

    await expectRevert(
      stakingRewards.setRewardsDuration(ZERO, { from: people.alice }),
      "Revert (message: Ownable: caller is not the people.owner)",
    )

    await expectRevert(
      stakingRewards.setRewardsDuration(ZERO),
      "Previous rewards period must be complete before changing the duration for the new period",
    );

    const periodFinish = await stakingRewards.periodFinish();
    const expectPeriodFinish = periodFinish.div(new BN('2'));

    await time.increaseTo(periodFinish.add(days('2')));

    const result = await stakingRewards.setRewardsDuration(expectPeriodFinish);
    expect(await stakingRewards.rewardsDuration()).to.be.bignumber.equal(expectPeriodFinish);
    expectEvent(result, "RewardsDurationUpdated", {
      newDuration: expectPeriodFinish,
    });
  });
});
