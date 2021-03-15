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
const { activeActor, actorStake, deployAndConfigureGovernance } = require(
  './utils/governance_redeploy'
);

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
  const bob = accounts[2];
  const keeper = accounts[3];

  const rewardsTokenTotalSupply = ether('1000');
  const governanceTokenTotalSupply = ether('3000');
  const stardId = ZERO;

  var treasury;
  var governanceContract;
  var governanceToken;
  var rewardsToken;
  var governanceToken;
  var oneSplitMock;

  beforeEach(async () => {

    treasury = await Treasury.new();
    oneSplitMock = await MockContract.new();

    [ governanceContract, governanceToken, rewardsToken ] = await deployAndConfigureGovernance(
      stardId,
      governanceTokenTotalSupply,
      governance,
      treasury.address,
      rewardsTokenTotalSupply,
      alice,
      rewardsTokenTotalSupply.div(new BN('2')),
      bob
    );

    await treasury.configure(
      governance,
      oneSplitMock.address,
      governanceContract.address,
      rewardsToken.address
    );

  });

  it('should configure properly', async () => {
    expect(await treasury.governance()).to.be.equal(governance);
    expect(await treasury.oneSplit()).to.be.equal(oneSplitMock.address);
    expect(await treasury.governanceContract()).to.be.equal(governanceContract.address);
    expect(await treasury.rewardsToken()).to.be.equal(rewardsToken.address);
    expect(await treasury.authorized(governance)).to.be.equal(true);
    expect(await governanceContract.rewardDistribution()).to.be.equal(treasury.address)
  });

  it('should get expected return when swapping whole balance', async () => {

  });

  it('should convert non-core tokens to rewards tokens', async () => {

  });

  it('should send tokens to governance contract (voters)', async () => {

  });

});
