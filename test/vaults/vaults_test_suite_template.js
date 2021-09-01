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

const testSuite = async () => {
  return () => {

    let owner;
    let alice;
    let bob;
    let charlie;

    beforeEach(async () => {

    });

    it('should configure properly', async () => {

    });

  };
};
