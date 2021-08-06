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

const redeploy = async () => {
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
}

contract('VotingStakingRewards', (accounts) => {

  setPeople(accounts);

  describe('configuration and setters', () => {

    beforeEach(async () => {
      await redeploy();
    });

    it('should configure properly', async () => {
      expect(await votingStakingRewards.rewardsToken()).to.be.equals(mockXBE.address);
      expect(await votingStakingRewards.stakingToken()).to.be.equals(mockXBE.address);
      expect(await votingStakingRewards.rewardsDistribution()).to.be.equals(treasury.address);
      expect(await votingStakingRewards.rewardsDuration()).to.be.bignumber.equals(common.days('14'));
      expect(await votingStakingRewards.token()).to.be.equals(veXBE.address);
      expect(await votingStakingRewards.voting()).to.be.equals(voting.address);
      expect(await votingStakingRewards.boostLogicProvider()).to.be.equals(boostLogicProvider.address);
      expect(await votingStakingRewards.treasury()).to.be.equals(treasury.address);
    });

    it('should set inverse max boost coef', async () => {
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

    it('should set penalty pct', async () => {
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

    it('should set bonded lock duration', async () => {
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

    it('should set boosting logic provider', async () => {
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

    // before(async () => {
    //   await redeploy();
    // });

    it('should get total supply', async () => {

    });

    it('should get balance of user', async () => {

    });

    it('should limit last time reward applicable', async () => {

    });

    it('should get reward per token', async () => {

    });

    it('should get reward for duration', async () => {

    });

    it('should get potential xbe returns', async () => {

    });

    it('should calculate boost level', async () => {

    });

    it('should get earned', async () => {

    });

  });

  describe('transfers', () => {
    beforeEach(async () => {
      await redeploy();
    });

    it('should notify accepted reward amount', async () => {

    });

    it('should stake', async () => {

    });

    it('should set allowance of staker', async () => {

    });

    it('should set strategy who can autostake', async () => {

    });

    it('should stake for', async () => {

    });

    it('should request withdraw bonded', async () => {

    });

    it('should withdraw bonded or with penalty', async () => {

    });

    it('should withdraw unbonded', async () => {

    });

    it('should get reward', async () => {

    });
  });


});
