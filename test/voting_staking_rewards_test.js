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

contract('VotingStakingRewards', (accounts) => {

  setPeople(accounts);

  beforeEach(async () => {
    [
      mockXBE,
      veXBE,
      boostLogicProvider,
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
  });

  it('should configure properly', async () => {
    expect(await votingStakingRewards.rewardsToken()).to.be.equals(mockXBE.address);
    expect(await votingStakingRewards.stakingToken()).to.be.equals(mockXBE.address);
    expect(await votingStakingRewards.rewardsDistribution()).to.be.equals(treasury.address);
    expect(await votingStakingRewards.rewardsDuration()).to.be.bignumber.equals(common.days('14'));
    expect(await votingStakingRewards.token()).to.be.equals(veXBE.address);
    // expect(await votingStakingRewards.voting()).to.be.equals(voting.address);
    expect(await votingStakingRewards.boostLogicProvider()).to.be.equals(boostLogicProvider.address);
    expect(await votingStakingRewards.treasury()).to.be.equals(treasury.address);
  });

});
