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
  getPotentialRewardReturnsTest,
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

const vaultName = 'HiveVault';

contract(vaultName, (accounts) => {

  setPeople(accounts);

  let owner;
  let alice;
  let bob;
  let charlie;

  let vault;
  let controller;
  let mockXBE;
  let mockCRV;
  let mockCVX;
  let mockLPHive;

  beforeEach(async () => {
    owner = await common.waitFor("owner", people);
    alice = await common.waitFor("alice", people);
    bob = await common.waitFor("bob", people);
    charlie = await common.waitFor("charlie", people);
    [
      mockXBE,
      mockCVX,
      mockCRV,
      mockLPHive,
      vault,
      controller
    ] = await environment.getGroup(
      [
        "ConvexBooster",
        "ConvexCRVRewards",
        "ConvexCVXRewards",
        "MockXBE",
        "MockCVX",
        "MockCRV",
        "MockLPHive",
        "Treasury",
        "VotingStakingRewards",
        "HiveStrategy",
        "ReferralProgram",
        "HiveVault",
        "Controller"
      ],
      (key) => [
        "MockXBE",
        "MockCVX",
        "MockCRV",
        "MockLPHive",
        "HiveVault",
        "Controller"
      ].includes(key),
      true,
      {
        "VotingStakingRewards": {
          4: ZERO_ADDRESS,
          5: ZERO_ADDRESS,
          8: [ ZERO_ADDRESS ]
        },
        "Treasury": {
          3: ZERO_ADDRESS
        }
      }
    );
    await vault.setRewardsDistribution(owner, { from: owner });
  });

  it('should configure general settings properly', async () => {
    expect(await vault.owner()).to.be.equal(owner);
    expect(await vault.stakingToken()).to.be.equal(mockLPHive.address);
    expect(await vault.controller()).to.be.equal(controller.address);
    expect(await vault.rewardsDuration()).to.be.bignumber.equal(
      utilsConstants.localParams.vaults.rewardsDuration
    );
    expect(await vault.isTokenValid(mockXBE.address)).to.be.true;
    expect(await vault.isTokenValid(mockCRV.address)).to.be.true;
    expect(await vault.isTokenValid(mockCVX.address)).to.be.true;
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

  it('should get last time rewards applicable', lastTimeRewardApplicableTest(vaultName));

  it('should get reward per token', getRewardPerTokenTest(vaultName));

  it('should get earned value', earnedTest(vaultName));

  it('should get user reward', userRewardTest(vaultName));

  it('should get balance both on vault and strategy', balanceTest(vaultName));

  it('should get potential reward returns', getPotentialRewardReturnsTest(vaultName));

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
