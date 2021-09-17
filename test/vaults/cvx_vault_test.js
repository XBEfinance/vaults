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
  // getPotentialRewardReturnsTest,
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

const vaultName = 'CVXVault';

contract(vaultName, (accounts) => {

  setPeople(accounts);

  let owner;
  let alice;
  let bob;
  let charlie;

  let vault;
  let controller;
  let mockXBE;
  let mockCvxCrv;
  let mockCVX;
  let cvxRewards;

  beforeEach(async () => {
    owner = await common.waitFor("owner", people);
    alice = await common.waitFor("alice", people);
    bob = await common.waitFor("bob", people);
    charlie = await common.waitFor("charlie", people);
    [
      cvxRewards,
      mockXBE,
      mockCVX,
      mockCvxCrv,
      vault,
      controller
    ] = await environment.getGroup(
      [
        "ConvexCVXRewards",
        "MockXBE",
        "MockCVX",
        "MockCvxCrv",
        "Treasury",
        "VotingStakingRewards",
        "CVXStrategy",
        "ReferralProgram",
        "CVXVault",
        "Controller"
      ],
      (key) => [
        "ConvexCVXRewards",
        "MockXBE",
        "MockCVX",
        "MockCvxCrv",
        "CVXVault",
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

  xit('should configure general settings properly', async () => {
    expect(await vault.owner()).to.be.equal(owner);
    expect(await vault.stakingToken()).to.be.equal(mockCVX.address);
    expect(await vault.controller()).to.be.equal(controller.address);
    expect(await vault.rewardsDuration()).to.be.bignumber.equal(
      utilsConstants.localParams.vaults.rewardsDuration
    );
    expect(await vault.isTokenValid(mockXBE.address)).to.be.true;
    expect(await vault.isTokenValid(mockCvxCrv.address)).to.be.true;
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

  it('should get reward tokens count', getRewardTokensCountTest(vaultName, new BN('2')));

  xit('should get last time rewards applicable', lastTimeRewardApplicableTest(vaultName));

  xit('should get reward per token', getRewardPerTokenTest(vaultName));

  xit('should get earned value', earnedTest(vaultName));

  xit('should get user reward', userRewardTest(vaultName));

  xit('should get balance both on vault and strategy', balanceTest(vaultName));

  // xit('should get potential reward returns', getPotentialRewardReturnsTest(vaultName));

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
