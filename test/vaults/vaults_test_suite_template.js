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

const common = require('./utils/common.js');
const utilsConstants = require('./utils/constants.js');
const artifacts = require('./utils/artifacts.js');
const environment = require('./utils/environment.js');
const { people, setPeople } = require('./utils/accounts.js');

const testSuite = async (vaultsContractName) => {
  return () => {

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
      ] = environment.getGroup(
        [
          "MockXBE",
          "MockCVX",
          "MockCRV",
          "MockLPHive",
          "HiveStrategy",
          "ReferralProgram",
          "Treasury",
          vaultsContractName,
          "Controller"

        ]
      );

    });

  };
};

module.exports = {
  testSuite
}
