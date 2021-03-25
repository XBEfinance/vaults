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
const { ZERO, ONE, getMockTokenPrepared, processEventArgs, checkSetter } = require('./utils/common');
const { activeActor, actorStake, deployAndConfigureGovernance } = require(
  './utils/governance_redeploy'
);

const IERC20 = artifacts.require("IERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');
const IOneSplitAudit = artifacts.require('IOneSplitAudit');
const TokenWrapper = artifacts.require('TokenWrapper');

const MockContract = artifacts.require("MockContract");

contract('TestExecutor', (accounts) => {});
