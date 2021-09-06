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

contract('CvxCrvVault', (accounts) => {

  setPeople(accounts);

  let owner;
  let alice;
  let bob;
  let charlie;

  let vault;
  let controller;
  let mockXBE;
  let mockCVX;
  let mockCRV;
  let mockCvxCrv;

  beforeEach(async () => {
    owner = await common.waitFor("owner", people);
    alice = await common.waitFor("alice", people);
    bob = await common.waitFor("bob", people);
    charlie = await common.waitFor("charlie", people);
    [
      mockXBE,
      mockCVX,
      mockCvxCrv,
      mockCRV,
      vault,
      controller
    ] = await environment.getGroup(
      [
        "ConvexCrvDepositor",
        "ConvexCvxCrvRewards",
        "MockXBE",
        "MockCVX",
        "MockCvxCrv",
        "MockCRV",
        "Treasury",
        "VotingStakingRewards",
        "CvxCrvStrategy",
        "ReferralProgram",
        "CvxCrvVault",
        "Controller"
      ],
      (key) => [
        "MockXBE",
        "MockCVX",
        "MockCvxCrv",
        "MockCRV",
        "CvxCrvVault",
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
  });

  it('should configure general settings properly', async () => {
    expect(await vault.owner()).to.be.equal(owner);
    expect(await vault.stakingToken()).to.be.equal(mockCvxCrv.address);
    expect(await vault.controller()).to.be.equal(controller.address);
    expect(await vault.rewardsDuration()).to.be.bignumber.equal(
      utilsConstants.localParams.vaults.rewardsDuration
    );
    expect(await vault.isTokenValid(mockXBE.address)).to.be.true;
    expect(await vault.isTokenValid(mockCRV.address)).to.be.true;
    expect(await vault.isTokenValid(mockCVX.address)).to.be.true;
  });

});
