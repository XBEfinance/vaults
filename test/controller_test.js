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

const { ZERO, CONVERSION_WEI_CONSTANT, getMockTokenPrepared } = require('./utils/common');
const { vaultInfrastructureRedeploy } = require('./utils/vault_infrastructure_redeploy');

const Controller = contract.fromArtifact("Controller");
const IERC20 = contract.fromArtifact("IERC20");
const IStrategy = contract.fromArtifact("IStrategy");
const MockToken = contract.fromArtifact('MockToken');
const IConverter = contract.fromArtifact('IConverter');
const IOneSplitAudit = contract.fromArtifact('IOneSplitAudit');
const InstitutionalEURxbStrategy = contract.fromArtifact('InstitutionalEURxbStrategy');
const InstitutionalEURxbVault = contract.fromArtifact('InstitutionalEURxbVault');
const UnwrappedToWrappedTokenConverter = contract.fromArtifact('UnwrappedToWrappedTokenConverter');
const TokenWrapper = contract.fromArtifact('TokenWrapper');

const MockContract = contract.fromArtifact("MockContract");

describe('Controller', () => {

  const governance = accounts[0];
  const miris = accounts[1];
  const strategist = accounts[2];


  var revenueToken;
  var controller;
  var strategy;
  var vault;
  var treasury
  var mock;
  var wrapper;

  beforeEach(async () => {
    [mock, controller, strategy, vault, revenueToken, treasury] = await vaultInfrastructureRedeploy(
      governance,
      strategist,
      InstitutionalEURxbStrategy,
      InstitutionalEURxbVault
    );
    wrapper = await TokenWrapper.new(
      "Banked EURxb",
      "bEURxb",
      revenueToken.address,
      strategy.address
    );

    await vault.configure(
      revenueToken.address,
      controller.address,
      wrapper.address,
      {from: governance}
    );
  });

  it('should configure properly', async () => {
    expect(await controller.strategist()).to.be.equal(strategist);
    expect(await controller.rewards()).to.be.equal(treasury.address);
  });

  it('should evacuate tokens from controller', async () => {
    const amount = ether('10');
    const toEvacuateByGovernance = ether('5');
    const toEvacuateByStrategist = ether('5');
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
    mockToken.approve(controller.address, amount, {from: miris});
    mockToken.transfer(controller.address, amount, {from: miris});

    await expectRevert(controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByGovernance,
      {from: miris}
    ), "!governance|strategist");

    await controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByGovernance,
      {from: governance}
    );
    await controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByStrategist,
      {from: strategist}
    );
    expect(await mockToken.balanceOf(governance)).to.be.bignumber.equals(toEvacuateByGovernance);
    expect(await mockToken.balanceOf(strategist)).to.be.bignumber.equals(toEvacuateByStrategist);
  });

  it('should evacuate all tokens from strategy', async () => {
    console.log(governance);
    await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, revenueToken.address, {from: governance}),
      "!want");
    const mockedBalance = ether('10');
    var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance, ether('123'), miris);

    await expectRevert(
      controller.inCaseStrategyTokenGetStuck(
        strategy.address,
        mockToken.address,
        {from: miris}
      ),
      "!governance|strategist"
    );

    await controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address, {from: governance});
    expect(await mockToken.balanceOf(controller.address)).to.be.bignumber.equal(mockedBalance);

    mock = await MockContract.new();
    mockToken = await MockToken.at(mock.address);
    await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address, {from: governance}),
      "!transfer");
  });

  it('should withdraw tokens from strategy', async () => {
    var mockedBalance = ether('10');
    var toWithdraw = ether('5');
    const balanceOfStrategyCalldata = revenueToken.contract
      .methods.balanceOf(strategy.address).encodeABI();
    await mock.givenCalldataReturnUint(balanceOfStrategyCalldata, mockedBalance);

    await strategy.setController(mock.address, {from: governance});

    const vaultsCalldata = controller.contract
      .methods.vaults(revenueToken.address).encodeABI();

    await mock.givenCalldataReturnAddress(vaultsCalldata, ZERO_ADDRESS);

    const invalidVault = await (await Controller.at(await strategy.controller()))
      .vaults(revenueToken.address);

    expect(invalidVault).to.be.equal(ZERO_ADDRESS);

    await strategy.setController(controller.address, {from: governance});

    const transferCalldata = revenueToken.contract
      .methods.transfer(miris, 0).encodeABI();

    await mock.givenMethodReturnBool(transferCalldata, false);

    const converter = await UnwrappedToWrappedTokenConverter.new();
    await converter.configure(revenueToken.address);

    await expectRevert(controller.withdraw(revenueToken.address, toWithdraw),
      "!transferVault");
  });

  it('should set one split parts', async () => {
    const oldParts = await controller.parts();
    await expectRevert(controller.setParts(oldParts, {from: governance}), '!old');
    const newParts = new BN('10');
    await controller.setParts(newParts, {from: governance});
    expect(await controller.parts()).to.be.bignumber.equal(newParts);
  });

  it('should set treasury address', async () => {
    await expectRevert(controller.setRewards(ZERO_ADDRESS, {from: governance}), '!treasury');
    await expectRevert(controller.setRewards(miris, {from: governance}), '!contract');
    await expectRevert(controller.setRewards(await controller.rewards(), {from: governance}), '!old');
    const newTreasury = mock.address;
    await controller.setRewards(newTreasury, {from: governance});
    expect(await controller.rewards()).to.be.bignumber.equal(newTreasury);
  });

  it('should set one split address', async () => {
    await expectRevert(controller.setOneSplit(await controller.oneSplit(), {from: governance}), '!old');
    const newOneSplit = mock.address;
    await controller.setOneSplit(newOneSplit, {from: governance});
    expect(await controller.oneSplit()).to.be.equal(newOneSplit);
  });

  it('should set strategist address', async () => {
    await expectRevert(controller.setStrategist(strategist, {from: governance}), '!old');
    const newStrategist = miris;
    await controller.setStrategist(newStrategist, {from: governance});
    expect(await controller.strategist()).to.be.equal(newStrategist);
  });

  it('should get treasury address', async () => {
    expect(await controller.rewards()).to.be.equal(treasury.address);
  });

  it('should get vault by token', async () => {
    expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
  });

  it('should get strategy by token', async () => {
    expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
  });


  it('should set vault by token', async () => {
    var mockToken = await getMockTokenPrepared(strategy.address, ether('10'), ether('123'), miris);
    await expectRevert(controller.setVault(revenueToken.address, vault.address, {from: governance}), '!vault 0');
    await controller.setVault(mockToken.address, mock.address, {from: governance});
    expect(await controller.vaults(mockToken.address)).to.be.equal(mock.address);
  });

  it('should set converter address', async () => {
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
    await controller.setConverter(revenueToken.address, mockToken.address, mock.address, {from: governance});
    expect(await controller.converters(revenueToken.address, mockToken.address, {from: governance})).to.be.equal(mock.address);
  });

  it('should set strategy address', async () => {
    await expectRevert(controller.setStrategy(revenueToken.address, mock.address, {from: governance}), '!approved');

    const transferCalldata = revenueToken.contract
      .methods.transfer(miris, 0).encodeABI();
    const balanceOfCalldata = revenueToken.contract
      .methods.balanceOf(miris).encodeABI();
    const mockedBalance = ether('10');

    await mock.givenMethodReturnUint(balanceOfCalldata, mockedBalance);
    await mock.givenMethodReturnBool(transferCalldata, true);

    await controller.setApprovedStrategy(revenueToken.address, mock.address, true, {from: governance});
    const receipt = await controller.setStrategy(revenueToken.address, mock.address, {from: governance});
    expectEvent(receipt, 'WithdrawToVaultAll', {
      _token: revenueToken.address
    });
    expect(await controller.strategies(revenueToken.address)).to.be.equal(mock.address);
  });

  it('should approve strategy address', async () => {
    await controller.setApprovedStrategy(revenueToken.address, mock.address, true, {from: governance});
    expect(await controller.approvedStrategies(revenueToken.address, mock.address, {from: governance})).to.be.equal(true);
  });

  it('should get approved strategy address', async () => {
    expect(await controller.approvedStrategies(revenueToken.address, mock.address)).to.be.equal(false);
  });

  it('should send tokens to the strategy and earn', async () => {
    const mockedBalance = ether('10');
    const sumToEarn = ether('1');
    const sumToEarnInRevenueToken = ether('2');

    var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance, ether('123'), miris);

    ////
    await controller.setApprovedStrategy(mockToken.address, strategy.address, true, {from: governance});
    await controller.setStrategy(mockToken.address, strategy.address, {from: governance});

    await expectRevert(controller.earn(mockToken.address, sumToEarn, {from: miris}), '!converter');
    ////

    ////

    await mock.reset();

    const secondMock = await MockContract.new();

    await controller.setApprovedStrategy(secondMock.address, mock.address, true, {from: governance});
    await controller.setStrategy(secondMock.address, mock.address, {from: governance});

    await controller.setConverter(secondMock.address, mock.address, mock.address, {from: governance});

    const wantCalldata = (await IStrategy.at(mock.address)).contract
      .methods.want().encodeABI();
    await mock.givenMethodReturnAddress(wantCalldata, mock.address);

    const transferSecondMockCalldata = (await IERC20.at(secondMock.address)).contract
      .methods.transfer(secondMock.address, 0).encodeABI();
    await secondMock.givenMethodReturnBool(transferSecondMockCalldata, false);

    await expectRevert(controller.earn(secondMock.address, sumToEarn, {from: miris}), '!transferConverterToken');
    ////

    ////
    const converterCalldata = (await IConverter.at(mock.address)).contract
      .methods.convert(strategy.address).encodeABI();

    await mock.givenCalldataReturnUint(converterCalldata, sumToEarnInRevenueToken);

    const transferCalldata = (await IERC20.at(mock.address)).contract
      .methods.transfer(ZERO_ADDRESS, ZERO).encodeABI();

    await secondMock.givenMethodReturnBool(transferSecondMockCalldata, true);

    await mock.givenMethodReturnBool(transferCalldata, false);
    await expectRevert(controller.earn(secondMock.address, sumToEarn, {from: miris}), '!transferStrategyWant');

    await mock.givenMethodReturnBool(transferCalldata, true);

    var receipt = await controller.earn(secondMock.address, sumToEarn, {from: miris});
    await expectEvent(receipt, "Earn");
    ////

    ///
    const vaultTransferCalldata = revenueToken.contract.
      methods.transfer(vault.address, 0).encodeABI();
    await mock.givenMethodReturnBool(vaultTransferCalldata, true);
    var transferMockCalldata = revenueToken.contract
      .methods.transfer(mock.address, 0).encodeABI();
    await mock.givenMethodReturnBool(transferMockCalldata, false);
    await expectRevert(controller.earn(revenueToken.address, sumToEarnInRevenueToken), '!transferStrategyToken');
    ///

    transferMockCalldata = revenueToken.contract
      .methods.transfer(mock.address, 0).encodeABI();
    await mock.givenMethodReturnBool(transferMockCalldata, true);
    receipt = await controller.earn(revenueToken.address, sumToEarnInRevenueToken);
    await expectEvent(receipt, "Earn", {
      _token: revenueToken.address,
      _amount: sumToEarnInRevenueToken
    });

  });

  const getMockTokenForStrategy = async () => {
    const tokensForStrategy = ether('10');
    return await getMockTokenPrepared(strategy.address, tokensForStrategy, ether('20'), miris);
  };

  it('should reject harvest if strategy want token is token passed into parameters', async () => {
    await expectRevert(controller.harvest(strategy.address, revenueToken.address, {from: governance}), '!want');
  });

  it('should emit no events if withdraw from strategy does not return any tokens', async () => {
    const mockToken = await getMockTokenForStrategy();
    var receipt = await controller.harvest(mock.address, mockToken.address, {from: governance});
    await expectEvent.notEmitted(receipt, "Transfer");
  });

  const prepareOneSplitCalls = async (swappedToWantAmount) => {
    const swapCalldata = (await IOneSplitAudit.at(mock.address)).contract
      .methods.swap(ZERO_ADDRESS, ZERO_ADDRESS, 0, 0, [], 0).encodeABI();
    await mock.givenMethodReturnUint(swapCalldata, swappedToWantAmount);

    const expectedReturnCalldata = (await IOneSplitAudit.at(mock.address)).contract
      .methods.getExpectedReturn(ZERO_ADDRESS, ZERO_ADDRESS, 0, 0, 0).encodeABI();
    await mock.givenMethodReturn(
      expectedReturnCalldata,
      web3.eth.abi.encodeParameters(
        ["uint256", "uint256[]"],
        [swappedToWantAmount, [ZERO, ZERO]]
      )
    );
  };

  const setBalanceOfWantToken = async (balanceOfWant) => {
    const balanceOfCalldata = revenueToken.contract
      .methods.balanceOf(ZERO_ADDRESS).encodeABI();
    await mock.givenMethodReturnUint(balanceOfCalldata, balanceOfWant);
  };

  it('should not emit Harvest event when #harvest() if one split return less tokens', async () => {
    const mockToken = await getMockTokenForStrategy();

    await controller.setOneSplit(mock.address, {from: governance});

    const swappedToWantAmount = ether('1');
    const balanceOfWant = ether('1.5');

    await prepareOneSplitCalls(swappedToWantAmount);
    await setBalanceOfWantToken(balanceOfWant);

    receipt = await controller.harvest(strategy.address, mockToken.address, {from: governance});
    await expectEvent.notEmitted(receipt, "Harvest");
  });

  const setEarnTransferStatus = async (swappedToWantAmount, balanceOfWant, status) => {
    const split = await controller.split();
    const max = await controller.max();

    const amount = swappedToWantAmount.sub(balanceOfWant);
    const rewardToSendToTreasury = amount.mul(split).div(max);

    const earnTransferCalldata = revenueToken.contract
      .methods.transfer(strategy.address, amount.sub(rewardToSendToTreasury)).encodeABI();
    await mock.givenCalldataReturnBool(earnTransferCalldata, status);
  };

  const setWantTokenTransferStatus = async (status) => {
    const transferCalldata = revenueToken.contract
      .methods.transfer(ZERO_ADDRESS, ZERO).encodeABI();
    await mock.givenMethodReturnBool(transferCalldata, status);
  };

  it('should reject when #harvest() when transfer to treasury failed', async () => {
    const mockToken = await getMockTokenForStrategy();
    await controller.setOneSplit(mock.address, {from: governance});

    const swappedToWantAmount = ether('12');
    const balanceOfWant = ether('0.1');

    await prepareOneSplitCalls(swappedToWantAmount);
    await setBalanceOfWantToken(balanceOfWant);
    await setEarnTransferStatus(swappedToWantAmount, balanceOfWant, true);
    await setWantTokenTransferStatus(false);

    await expectRevert(
      controller.harvest(
        strategy.address,
        mockToken.address,
        {from: governance}
      ),
      "!transferTreasury"
    );
  });

  it('should revert if #harvest() called not by governance or strategy contract', async () => {
    await expectRevert(controller.harvest(ZERO_ADDRESS, ZERO_ADDRESS, {from: miris}), "!governance|strategist");
  });

  it('should harvest tokens from the strategy', async () => {

    const mockToken = await getMockTokenForStrategy();
    await controller.setOneSplit(mock.address, {from: governance});

    const swappedToWantAmount = ether('1');
    const balanceOfWant = ether('0.1');

    await prepareOneSplitCalls(swappedToWantAmount);
    await setBalanceOfWantToken(balanceOfWant);
    await setEarnTransferStatus(swappedToWantAmount, balanceOfWant, true);
    await setWantTokenTransferStatus(true);

    receipt = await controller.harvest(strategy.address, mockToken.address, {from: governance});
    await expectEvent(receipt, "Harvest", {
      _strategy: strategy.address,
      _token: mockToken.address
    });

  });

});
