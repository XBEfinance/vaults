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
  ecdsaSign,
  eip712signer,
  eowSigner,
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

  const ownersPrivateKeys = [
    "e5c8ff0a2acbbe1ac2b2af56a52c08152ac6ceb61b624b1e3310a7b970547bcb",
    "6475573347e9ee14813796817f16ef3632d290e15b8cedde0fe859782830a8d2",
    "7a22592e44a2a1d1b22aea6ea534219285601eb644fddd34f1042ce953644bc0"
  ];

  const alice = accounts[3];
  const aliceAmount = ether('0.013');

  const thirdPartyTxExecutor = firstOwner; // can be anyone, even owner

  var mock;
  var mockToken;
  var governanceContract;
  var safe;
  var executor;

  var proposalId;

  const proposalHash = "some proposal hash";
  const minumumForVoting = ether('0.012');
  const quorumForVoting = ONE;
  const periodForVoting = new BN('2');
  const lockForVoting = new BN('2');


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
      alice
    );

    await mockToken.approve(safe.address, aliceAmount, {from: firstOwner});
    await mockToken.transfer(safe.address, aliceAmount, {from: firstOwner});

    await governanceContract.setMinimum(minumumForVoting);
    await governanceContract.setPeriod(periodForVoting);
    await governanceContract.setQuorum(quorumForVoting);
    await governanceContract.setLock(lockForVoting);

    await governanceContract.register();

    const votingBalance = minumumForVoting.add(ether('0.002'));
    await mockToken.approve(governanceContract.address, votingBalance, {from: firstOwner});
    await governanceContract.stake(votingBalance, {from: firstOwner});

    proposalId = await governanceContract.proposalCount();
    await governanceContract.propose(executor.address, proposalHash);
    // await timeout(10000);
    await governanceContract.voteFor(proposalId);

    await governanceContract.setGovernance(safe.address);

  });

  it('should execute an executor from safe name', async () => {

    await executeTransactionWithSigner(
      eip712signer,
      safe,
      'executeTransaction call approve method',
      [firstOwner, secondOwner, thirdOwner],
      mockToken.address,
      ZERO,
      mockToken.contract.methods.approve(executor.address, aliceAmount).encodeABI(),
      CALL,
      thirdPartyTxExecutor
    );

    await executeTransactionWithSigner(
      eip712signer,
      safe,
      'executeTransaction call approve method',
      [firstOwner, secondOwner, thirdOwner],
      mockToken.address,
      ZERO,
      mockToken.contract.methods.transfer(executor.address, aliceAmount).encodeABI(),
      CALL,
      thirdPartyTxExecutor
    );

    await timeout(15000); // avg block mining time is 15s, but we go 30 just to be sure

    await governanceContract.execute(proposalId, {from: thirdPartyTxExecutor});

    // safe operation just to be able to reproduce the tests
    await executeTransactionWithSigner(
      eip712signer,
      safe,
      'executeTransaction set governance',
      [firstOwner, secondOwner, thirdOwner],
      mockToken.address,
      ZERO,
      governanceContract.contract.methods.setGovernance(firstOwner).encodeABI(),
      CALL,
      thirdPartyTxExecutor
    );

    expect(await mockToken.balanceOf(alice)).to.be.bignumber.equal(aliceAmount);

  });

});
