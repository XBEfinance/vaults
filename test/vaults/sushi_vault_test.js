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
const { ZERO_ADDRESS } = constants;

const common = require('../utils/common.js');
const utilsConstants = require('../utils/constants.js');
const artifacts = require('../utils/artifacts.js');
const environment = require('../utils/environment.js');
const { people, setPeople } = require('../utils/accounts.js');

const {
  setControllerTest,
  setRewardsDistributionTest,
  setRewardsDurationTest,
  pauseTest,
  unpauseTest,
  addRewardTokenTest,
  removeRewardTokenTest,
  checkRewardTokenTest,
  getRewardTokenByIndexTest,
  getRewardTokensCountTest,
  lastTimeRewardApplicableTest,
  getRewardPerTokenTest,
  earnedTest,
  userRewardTest,
  balanceTest,
  depositTest,
  depositForTest,
  depositAllTest,
  withdrawTest,
  withdrawAllTest,
  withdrawWithCustomizableClaimTest,
  getRewardTest,
  notifyRewardAmountTest,
  earnTest
} = require('./vaults_test_suite_template.js');

contract('SushiVault', (accounts) => {
  setPeople(accounts);

  let owner;
  let alice;
  let bob;
  let charlie;

  let vault;
  let controller;
  let mockXBE;
  let mockLPSushi;

  beforeEach(async () => {
    owner = await common.waitFor('owner', people);
    alice = await common.waitFor('alice', people);
    bob = await common.waitFor('bob', people);
    charlie = await common.waitFor('charlie', people);
    [
      mockXBE,
      mockLPSushi,
      controller,
      vault,
    ] = await environment.getGroup(
      [
        'MockXBE',
        'MockLPSushi',
        'Treasury',
        'VotingStakingRewards',
        'Controller',
        'SushiVault',
        'SushiStrategy',
      ],
      (key) => [
        'MockXBE',
        'MockLPSushi',
        'Controller',
        'SushiVault',
      ].includes(key),
      true,
      {
        'VotingStakingRewards': {
          4: ZERO_ADDRESS,
          5: ZERO_ADDRESS,
          8: [ ZERO_ADDRESS ]
        },
        'Treasury': {
          3: ZERO_ADDRESS
        }
      }
    );
  });

  const vaultName = 'SushiVault';

  it('should configure general settings properly', async () => {
    expect(await vault.owner()).to.be.equal(owner);
    expect(await vault.stakingToken()).to.be.equal(mockLPSushi.address);
    expect(await vault.controller()).to.be.equal(controller.address);
    expect(await vault.rewardsDuration()).to.be.bignumber.equal(
      utilsConstants.localParams.vaults.rewardsDuration
    );
    expect(await vault.isTokenValid(mockXBE.address)).to.be.true;
  });

  it('should delegate reward, if seller is owner', async () => {
    await expectRevert(vault.setDelegator(alice, charlie, { from: charlie }), 'Ownable: caller is not the owner');
    // delegate alice rewards for charlie
    await vault.setDelegator(alice, charlie);
    // check rewardDelegators
    expect(await vault.rewardDelegators(alice)).to.be.equal(charlie);
  });

  it.only('should recive reward for delegator', async () => {
    // delegate alice rewards for charlie
    await vault.setDelegator(alice, charlie);
    // deposits funds for alice and charlie (50% vs 50%)
    const balanceSushi = await mockLPSushi.balanceOf(owner);
    await mockLPSushi.approve(vault.address, balanceSushi);
    await vault.deposit(balanceSushi);
    const balanceVault = await vault.balanceOf(owner);
    await vault.transfer(alice, balanceVault.divn(2));
    await vault.transfer(charlie, balanceVault.divn(2));
    // add reward to vault
    await vault.setRewardsDistribution(owner);
    await mockXBE.transfer(vault.address, ether('100'));
    await vault.notifyRewardAmount(mockXBE.address, ether('100'));
    // increase time
    await time.increase(time.duration.years(1)); // rewardDuration in test is equal 12 mounth
    // owner hasn't vault tokens and didn't receive reward
    const ownerXBEBalanceBefore = await mockXBE.balanceOf(owner);
    await vault.getReward(true);
    expect(await mockXBE.balanceOf(owner)).to.be.bignumber.equal(ownerXBEBalanceBefore);
    // charlie autostake her rewards
    await vault.getReward(true, { from: charlie });
    expect(await mockXBE.balanceOf(charlie)).to.be.bignumber.zero;
    // only charlie get reward for alice
    await expectRevert(vault.getRewardForDelegator(alice, { from: alice }), 'unknown sender');
    await expectRevert(vault.getRewardForDelegator(alice, { from: owner }), 'unknown sender');
    await vault.getRewardForDelegator(alice, { from: charlie });
    expect(
      ether('50').sub(await mockXBE.balanceOf(charlie)),
    ).to.be.bignumber.lt(ether('0.0000000001')); // 50 - balanceAfter ~= 0
    // check that both rewards has been recived
    expect(await vault.earned(mockXBE.address, charlie)).to.be.bignumber.zero;
    expect(await vault.earned(mockXBE.address, alice)).to.be.bignumber.zero;
    expect(ether('50').sub(await mockXBE.balanceOf(charlie))).to.be.bignumber.lt(ether('0.0000000001')); // 50 - balanceAfter ~= 0
    // all user can withdraw vault tokens
    await vault.withdrawAll({ from: alice });
    await vault.withdrawAll({ from: charlie });
  });

  xit('should set controller properly',
    setControllerTest(vaultName));

  xit('should set rewards distribution properly',
    setRewardsDistributionTest(vaultName));

  xit('should set rewards duration properly',
    setRewardsDurationTest(vaultName));

  xit('should pause properly', pauseTest(vaultName));

  xit('should unpause properly', unpauseTest(vaultName));

  xit('should add reward token properly', addRewardTokenTest(vaultName));

  xit('should remove reward token properly', removeRewardTokenTest(vaultName));

  xit('should check if reward token valid', checkRewardTokenTest(vaultName));

  xit('should get reward token by index', getRewardTokenByIndexTest(vaultName));

  xit('should get reward tokens count', getRewardTokensCountTest(vaultName));

  xit('should get last time rewards applicable', lastTimeRewardApplicableTest(vaultName));

  it('should get reward per token', getRewardPerTokenTest(vaultName));

  it('should get earned value', earnedTest(vaultName));

  it('should get user reward', userRewardTest(vaultName));

  it('should get balance both on vault and strategy', balanceTest(vaultName));

  xit('should deposit', depositTest(vaultName));

  xit('should deposit for', depositForTest(vaultName));

  xit('should deposit all', depositAllTest(vaultName));

  xit('should withdraw', withdrawTest(vaultName));

  xit('should withdraw all', withdrawAllTest(vaultName));

  xit('should withdraw with customizable claim', withdrawWithCustomizableClaimTest(vaultName));

  xit('should get reward', getRewardTest(vaultName));

  xit('should notify reward amount', notifyRewardAmountTest(vaultName));

  xit('should perform earn method', earnTest(vaultName));
});
