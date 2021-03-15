/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const { ZERO, ONE, getMockTokenPrepared, processEventArgs } = require('./utils/common');

const IERC20 = artifacts.require("IERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');
const IOneSplitAudit = artifacts.require('IOneSplitAudit');
const Treasury = artifacts.require('Treasury');
const Governance = artifacts.require('Governance');

const MockContract = artifacts.require("MockContract");

contract('Treasury', (accounts) => {

  const governance = accounts[0];
  const alice = accounts[1];

});
