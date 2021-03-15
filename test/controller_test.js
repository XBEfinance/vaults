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

const { ZERO, CONVERSION_WEI_CONSTANT, getMockTokenPrepared } = require('./utils/common');
const { vaultInfrastructureRedeploy } = require('./utils/vault_infrastructure_redeploy');

const Controller = artifacts.require("Controller");
const IERC20 = artifacts.require("IERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');
const IConverter = artifacts.require('IConverter');
const IOneSplitAudit = artifacts.require('IOneSplitAudit');

const MockContract = artifacts.require("MockContract");

contract('Controller', (accounts) => {

  const governance = accounts[0];
  const miris = accounts[1];
  const strategist = accounts[2];


  var revenueToken;
  var controller;
  var strategy;
  var vault;
  var mock;

  beforeEach(async () => {
    [mock, controller, strategy, vault, revenueToken] = await vaultInfrastructureRedeploy(
      governance,
      strategist
    );
  });

  it('should configure properly', async () => {
    expect(await controller.strategist()).to.be.equal(strategist);
    expect(await controller.rewards()).to.be.equal(vault.address);
  });

  it('should evacuate tokens from controller', async () => {
    const amount = ether('10');
    const toEvacuateByGovernance = ether('5');
    const toEvacuateByStrategist = ether('5');
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
    mockToken.approve(controller.address, amount, {from: miris});
    mockToken.transfer(controller.address, amount, {from: miris});
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
    await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, revenueToken.address),
      "!want");
    const mockedBalance = ether('10');
    var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance, ether('123'), miris);
    await controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address);
    expect(await mockToken.balanceOf(controller.address)).to.be.bignumber.equal(mockedBalance);

    mock = await MockContract.new();
    mockToken = await MockToken.at(mock.address);
    await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address),
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

    await expectRevert(controller.withdraw(revenueToken.address, toWithdraw),
      "!transferStrategy");
  });

  it('should set one split parts', async () => {
    const oldParts = await controller.parts();
    await expectRevert(controller.setParts(oldParts), '!old');
    const newParts = new BN('10');
    await controller.setParts(newParts, {from: governance});
    expect(await controller.parts()).to.be.bignumber.equal(newParts);
  });

  it('should set treasury address', async () => {
    await expectRevert(controller.setRewards(ZERO_ADDRESS), '!treasury');
    await expectRevert(controller.setRewards(miris), '!contract');
    await expectRevert(controller.setRewards(await controller.rewards()), '!old');
    const newTreasury = mock.address;
    await controller.setRewards(newTreasury, {from: governance});
    expect(await controller.rewards()).to.be.bignumber.equal(newTreasury);
  });

  it('should set one split address', async () => {
    await expectRevert(controller.setOneSplit(await controller.oneSplit()), '!old');
    const newOneSplit = mock.address;
    await controller.setOneSplit(newOneSplit);
    expect(await controller.oneSplit()).to.be.equal(newOneSplit);
  });

  it('should set strategist address', async () => {
    await expectRevert(controller.setStrategist(strategist), '!old');
    const newStrategist = miris;
    await controller.setStrategist(newStrategist);
    expect(await controller.strategist()).to.be.equal(newStrategist);
  });

  it('should get treasury address', async () => {
    // it could be any contract address, I just picked up vault randomly
    expect(await controller.rewards()).to.be.equal(vault.address);
  });

  it('should get vault by token', async () => {
    expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
  });

  it('should get strategy by token', async () => {
    expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
  });


  it('should set vault by token', async () => {
    var mockToken = await getMockTokenPrepared(strategy.address, ether('10'), ether('123'), miris);
    await expectRevert(controller.setVault(revenueToken.address, vault.address), '!vault 0');
    await controller.setVault(mockToken.address, mock.address);
    expect(await controller.vaults(mockToken.address)).to.be.equal(mock.address);
  });

  it('should set converter address', async () => {
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
    await controller.setConverter(revenueToken.address, mockToken.address, mock.address);
    expect(await controller.converters(revenueToken.address, mockToken.address)).to.be.equal(mock.address);
  });

  it('should set strategy address', async () => {
    await expectRevert(controller.setStrategy(revenueToken.address, mock.address), '!approved');

    const transferCalldata = revenueToken.contract
      .methods.transfer(miris, 0).encodeABI();
    const balanceOfCalldata = revenueToken.contract
      .methods.balanceOf(miris).encodeABI();
    const mockedBalance = ether('10');

    await mock.givenMethodReturnUint(balanceOfCalldata, mockedBalance);
    await mock.givenMethodReturnBool(transferCalldata, true);

    await controller.setApprovedStrategy(revenueToken.address, mock.address, true);
    const receipt = await controller.setStrategy(revenueToken.address, mock.address);
    expectEvent(receipt, 'WithdrawToVaultAll', {
      _token: revenueToken.address
    });
    expect(await controller.strategies(revenueToken.address)).to.be.equal(mock.address);
  });

  it('should approve strategy address', async () => {
    await controller.setApprovedStrategy(revenueToken.address, mock.address, true);
    expect(await controller.approvedStrategies(revenueToken.address, mock.address)).to.be.equal(true);
  });

  it('should get approved strategy address', async () => {
    expect(await controller.approvedStrategies(revenueToken.address, mock.address)).to.be.equal(false);
  });

  it('should send tokens to the strategy and earn', async () => {
    const mockedBalance = ether('10');
    const sumToEarn = ether('1');
    const sumToEarnInRevenueToken = ether('2');

    var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance, miris);

    ////
    await controller.setApprovedStrategy(mockToken.address, strategy.address, true);
    await controller.setStrategy(mockToken.address, strategy.address);

    await expectRevert(controller.earn(mockToken.address, sumToEarn, {from: miris}), '!converter');
    ////

    ////

    await mock.reset();

    const secondMock = await MockContract.new();

    await controller.setApprovedStrategy(secondMock.address, mock.address, true);
    await controller.setStrategy(secondMock.address, mock.address);

    await controller.setConverter(secondMock.address, mock.address, mock.address);

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
      .methods.transfer(mock.address, sumToEarnInRevenueToken).encodeABI();

    await secondMock.givenMethodReturnBool(transferSecondMockCalldata, true);


    await mock.givenCalldataReturnBool(transferCalldata, false);
    await expectRevert(controller.earn(secondMock.address, sumToEarn, {from: miris}), '!transferStrategyWant');
    ////

    ///
    const vaultTransferCalldata = revenueToken.contract.
      methods.transfer(vault.address, 0).encodeABI();
    await mock.givenMethodReturnBool(vaultTransferCalldata, true);
    const transferMockCalldata = revenueToken.contract
      .methods.transfer(mock.address, 0).encodeABI();
    await mock.givenMethodReturnBool(transferMockCalldata, false);
    await expectRevert(controller.earn(revenueToken.address, sumToEarnInRevenueToken), '!transferStrategyToken');
    ///

  });

  it('should harvest tokens from the strategy', async () => {

    const mockedBalance = ether('10');
    var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance, ether('123'), miris);

    const wantCalldata = (await IStrategy.at(mock.address)).contract
      .methods.want().encodeABI();
    await mock.givenMethodReturnAddress(wantCalldata, mockToken.address);
    await expectRevert(controller.harvest(mock.address, mockToken.address), '!want');

    await mock.reset();

    const tokensForStrategy = ether('2');

    await mockToken.approve(strategy.address, tokensForStrategy, {from: miris});
    await mockToken.transfer(strategy.address, tokensForStrategy, {from: miris});

    await controller.setOneSplit(mock.address);

    const swapCalldata = (await IOneSplitAudit.at(mock.address)).contract
      .methods.swap(mock.address, mock.address, 0, 0, [], 0).encodeABI();

    const expectedReturnCalldata = (await IOneSplitAudit.at(mock.address)).contract
      .methods.getExpectedReturn(mock.address, mock.address, 0, 0, 0).encodeABI();

    const swappedToWantAmount = ether('3');

    await mock.givenMethodReturnUint(swapCalldata, swappedToWantAmount);
    await mock.givenMethodReturn(
      expectedReturnCalldata,
      web3.eth.abi.encodeParameters(
        ["uint256", "uint256[]"],
        [swappedToWantAmount, [ZERO, ZERO]]
      )
    );

    const transferCalldata = revenueToken.contract
      .methods.transfer(mock.address, 0).encodeABI();

    const split = await controller.split();
    const max = await controller.max();

    const earnTransferCalldata = revenueToken.contract
      .methods.transfer(strategy.address, swappedToWantAmount.mul(split).div(max)).encodeABI();

    await mock.givenMethodReturnBool(transferCalldata, false);
    await mock.givenCalldataReturnBool(earnTransferCalldata, true);

    await expectRevert(controller.harvest(strategy.address, mockToken.address), "!transferTreasury");

  });

});
