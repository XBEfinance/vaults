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
const { accounts, contract } = require('@openzeppelin/test-environment');
const { ZERO_ADDRESS } = constants;
const { ZERO, ONE, getMockTokenPrepared, processEventArgs, checkSetter } = require('./utils/old/common');
const { activeActor, actorStake, deployAndConfigureGovernance } = require(
  './utils/old/governance_redeploy'
);

const IERC20 = contract.fromArtifact("IERC20");
const IStrategy = contract.fromArtifact("IStrategy");
const MockToken = contract.fromArtifact('MockToken');
const IOneSplitAudit = contract.fromArtifact('IOneSplitAudit');
const Treasury = contract.fromArtifact('Treasury');
const Governance = contract.fromArtifact('Governance');

const MockContract = contract.fromArtifact("MockContract");

contract('Treasury', () => {

  const governance = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  const keeper = accounts[3];

  const rewardsTokenTotalSupply = ether('1000');
  const governanceTokenTotalSupply = ether('3000');
  const startId = ZERO;

  let treasury;
  let governanceContract;
  let governanceToken;
  let rewardsToken;
  let oneSplitMock;

  beforeEach(async () => {

    treasury = await Treasury.new({from: governance});
    oneSplitMock = await MockContract.new({from: governance});

    [ governanceContract, governanceToken, rewardsToken ] = await deployAndConfigureGovernance(
      startId,
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
      rewardsToken.address,
      {from: governance}
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

  describe('setters', () => {

    it(`should check setter setOneSplit functional`, async () => {
      await checkSetter(
        'setOneSplit',
        'oneSplit',
        (await MockContract.new()).address,
        governance,
        alice,
        treasury,
        "!governance"
      );
    });

    it(`should check setter setRewardsToken functional`, async () => {
      await checkSetter(
        'setRewardsToken',
        'rewardsToken',
        (await MockContract.new()).address,
        governance,
        alice,
        treasury,
        "!governance"
      );
    });

    it(`should check setter setGovernanceContract functional`, async () => {
      await checkSetter(
        'setGovernanceContract',
        'governanceContract',
        (await MockContract.new()).address,
        governance,
        alice,
        treasury,
        "!governance"
      );
    });

    it('should check authorized address setter', async () => {
      const mockAddress = (await MockContract.new()).address;
      await treasury.setAuthorized(mockAddress, true, {from: governance});
      expect(await treasury.authorized(mockAddress)).to.be.equal(true);
    });

    it('should revert authorized address setter usage if sender != governance', async () => {
      await expectRevert(treasury.setAuthorized((await MockContract.new()).address, true, {from: alice}), "!governance")
    });

  });

  it('should get expected return when swapping whole balance', async () => {

    const balance = ether('1');
    const totalSupply = ether('2');
    const parts = new BN('100');
    const fromToken = await getMockTokenPrepared(alice, balance, totalSupply, bob);
    await fromToken.approve(treasury.address, balance, {from: alice});
    await fromToken.transfer(treasury.address, balance, {from: alice});

    const toToken = await MockContract.new();

    const mockedExpectedReturn = ether('3');
    const expectedReturnCalldata = (await IOneSplitAudit.at(oneSplitMock.address)).contract
      .methods.getExpectedReturn(
        fromToken.address,
        toToken.address,
        balance,
        parts,
        ZERO
      ).encodeABI();

    await oneSplitMock.givenCalldataReturn(
      expectedReturnCalldata,
      web3.eth.abi.encodeParameters(
        ["uint256", "uint256[]"],
        [mockedExpectedReturn, [ZERO, ZERO]]
      )
    );

    expect(await treasury.getExpectedReturn(
      fromToken.address,
      toToken.address,
      parts
    )).to.be.bignumber.equal(mockedExpectedReturn);

  });

  it('should convert non-core tokens to rewards tokens', async () => {
    const balance = ether('1');
    const totalSupply = ether('2');
    const parts = new BN('100');
    const fromToken = await getMockTokenPrepared(alice, balance, totalSupply, bob);
    await fromToken.approve(treasury.address, balance, {from: alice});
    await fromToken.transfer(treasury.address, balance, {from: alice});

    const mockedExpectedReturn = ether('3');
    const expectedReturnCalldata = (await IOneSplitAudit.at(oneSplitMock.address)).contract
      .methods.getExpectedReturn(
        fromToken.address,
        rewardsToken.address,
        balance,
        parts,
        ZERO
      ).encodeABI();

    const mockedOneSplitDistribution = [ZERO, new BN('100')];

    await oneSplitMock.givenCalldataReturn(
      expectedReturnCalldata,
      web3.eth.abi.encodeParameters(
        ["uint256", "uint256[]"],
        [mockedExpectedReturn, mockedOneSplitDistribution]
      )
    );

    const swapCalldata = (await IOneSplitAudit.at(oneSplitMock.address)).contract
      .methods.swap(
        fromToken.address,
        rewardsToken.address,
        balance,
        mockedExpectedReturn,
        mockedOneSplitDistribution,
        ZERO
      ).encodeABI();

    await expectRevert(treasury.convert(fromToken.address, parts, {from: alice}), "!authorized");

    await treasury.convert(fromToken.address, parts, {from: governance});
    expect(await fromToken.allowance(treasury.address, oneSplitMock.address)).to.be.bignumber.equal(balance);
  });

  it('should send tokens to governance contract (#toVoters)', async () => {
    const balance = ether('100');
    await rewardsToken.approve(treasury.address, balance, {from: alice});
    await rewardsToken.transfer(treasury.address, balance, {from: alice});
    await treasury.toVoters();
    expect(await rewardsToken.balanceOf(governanceContract.address)).to.be.bignumber.equal(balance);
  });

  it('should send tokens to governance address (#toGovernance)', async () => {
    const balance = ether('100');
    const balanceToSendToGovernance = ether('50');
    await rewardsToken.approve(treasury.address, balance, {from: alice});
    await rewardsToken.transfer(treasury.address, balance, {from: alice});
    await treasury.toGovernance(rewardsToken.address, balanceToSendToGovernance, {from: governance});
    expect(await rewardsToken.balanceOf(governance)).to.be.bignumber.equal(balanceToSendToGovernance);
  });
});
