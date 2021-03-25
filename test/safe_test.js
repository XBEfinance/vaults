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
const {
  signTypedData,
  signer,
  executeTransactionWithSigner,
  CALL,
  CREATE,
  DELEGATE_CALL
} = require('./utils/safe_sign');

const TestExecutor = artifacts.require("TestExecutor");
const MockContract = artifacts.require("MockContract");
const Governance = artifacts.require("Governance");
const MockToken = artifacts.require("MockToken");
const IGnosisSafe = artifacts.require("IGnosisSafe");

contract('TestExecutor', (accounts) => {

  const firstOwner = accounts[0];
  const secondOwner = accounts[1];
  const thirdOwner = accounts[2];

  const alice = accounts[3];
  const aliceAmount = ether('0.01');

  const thirdPartyTxExecutor = accounts[4]; // can be anyone, even owner

  var mock;
  var mockToken;
  var governanceContract;
  var safe;
  var executor;

  var proposalId;

  const proposalHash = "some proposal hash";
  const minumumForVoting = ether('0.01');
  const quorumForVoting = ONE;
  const periodForVoting = ONE;
  const lockForVoting = ZERO;

  const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  before(async () => {
    mock = await MockContract.deployed();
    mockToken = await MockToken.deployed();
    governanceContract = await Governance.deployed();
    safe = await IGnosisSafe.at("0xD78D94634d8F2E3eFADE97A5D13Da04c92440e67");
    executor = await TestExecutor.deployed();

    await governanceContract.configure(
      ZERO,
      mockToken.address,
      firstOwner,
      mockToken.address,
      firstOwner
    );

    await executor.configure(
      mockToken.address,
      safe.address,
      alice,
      aliceAmount
    );

    await mockToken.approve(safe.address, aliceAmount, {from: firstOwner});
    await mockToken.transfer(safe.address, aliceAmount, {from: firstOwner});

    await governanceContract.setMinimum(minumumForVoting);
    await governanceContract.setPeriod(periodForVoting);
    await governanceContract.setQuorum(quorumForVoting);
    await governanceContract.setLock(lockForVoting);

    await governanceContract.register();

    await mockToken.approve(governanceContract.address, minumumForVoting, {from: firstOwner});
    await governanceContract.stake(minumumForVoting, {from: firstOwner});


    proposalId = await governanceContract.proposalCount();
    await governanceContract.propose(executor.address, proposalHash);
    await governanceContract.voteFor(proposalId);

    await governanceContract.setGovernance(safe.address);

  });

  it('should execute an executor from safe name', async () => {
    await executeTransactionWithSigner(
      signer,
      safe.address,
      'executeTransaction call approve method',
      [firstOwner, secondOwner, thirdOwner],
      mockToken.address,
      ZERO,
      mockToken.contract.approve.getData(alice, aliceAmount),
      CALL,
      thirdPartyTxExecutor
    );

    await timeout(30000); // avg block mining time is 15s, but we go 30 just to be sure

    await governanceContract.execute(proposalId, {from: thirdPartyTxExecutor});

    // safe operation just to be able to reproduce the tests
    await executeTransactionWithSigner(
      signer, safe.address, 'executeTransaction call Executor method',
      [firstOwner, secondOwner, thirdOwner],
      mockToken.address,
      ZERO,
      governanceContract.contract.setGovernance.getData(firstOwner),
      CALL,
      thirdPartyTxExecutor
    );

    expect(await mockToken.balanceOf(alice)).to.be.bignumber.equal(aliceAmount);

  });

});
