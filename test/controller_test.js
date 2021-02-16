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

const { ZERO, CONVERSION_WEI_CONSTANT } = require('./utils/common');
const { vaultInfrastructureRedeploy } = require('./utils/vault_infrastructure_redeploy');

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const Controller = artifacts.require("Controller");
const ERC20 = artifacts.require("ERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');
const IConverter = artifacts.require('IConverter');

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
  var treasuryAddress;

  const getMockTokenPrepared = async (mintTo, mockedAmount) => {
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
    await mockToken.approve(mintTo, mockedAmount, {from: miris});
    await mockToken.transfer(mintTo, mockedAmount, {from: miris});
    return mockToken;
  };

  beforeEach(async () => {
    [mock, controller, strategy, vault, revenueToken] = await vaultInfrastructureRedeploy(
      governance,
      strategist
    );
  });

  // it('should configure properly', async () => {
  //   expect(await controller.strategist()).to.be.equal(strategist);
  //   expect(await controller.rewards()).to.be.equal(treasuryAddress);
  // });
  //
  // it('should evacuate tokens from controller', async () => {
  //   const amount = ether('10');
  //   const toEvacuateByGovernance = ether('5');
  //   const toEvacuateByStrategist = ether('5');
  //   const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
  //   mockToken.approve(controller.address, amount, {from: miris});
  //   mockToken.transfer(controller.address, amount, {from: miris});
  //   await controller.inCaseTokensGetStuck(
  //     mockToken.address, toEvacuateByGovernance,
  //     {from: governance}
  //   );
  //   await controller.inCaseTokensGetStuck(
  //     mockToken.address, toEvacuateByStrategist,
  //     {from: strategist}
  //   );
  //   expect(await mockToken.balanceOf(governance)).to.be.bignumber.equals(toEvacuateByGovernance);
  //   expect(await mockToken.balanceOf(strategist)).to.be.bignumber.equals(toEvacuateByStrategist);
  // });
  //
  // it('should evacuate all tokens from strategy', async () => {
  //   await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, revenueToken.address),
  //     "!want");
  //   const mockedBalance = ether('10');
  //   var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance);
  //   await controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address);
  //   expect(await mockToken.balanceOf(controller.address)).to.be.bignumber.equal(mockedBalance);
  //
  //   mock = await MockContract.new();
  //   mockToken = await MockToken.at(mock.address);
  //   await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address),
  //     "!transfer");
  // });
  //
  // it('should withdraw tokens from strategy', async () => {
  //   var mockedBalance = ether('10');
  //   var toWithdraw = ether('5');
  //   const balanceOfStrategyCalldata = revenueToken.contract
  //     .methods.balanceOf(strategy.address).encodeABI();
  //   await mock.givenCalldataReturnUint(balanceOfStrategyCalldata, mockedBalance);
  //
  //   await strategy.setController(mock.address, {from: governance});
  //
  //   const vaultsCalldata = controller.contract
  //     .methods.vaults(revenueToken.address).encodeABI();
  //
  //   await mock.givenCalldataReturnAddress(vaultsCalldata, ZERO_ADDRESS);
  //
  //   const invalidVault = await (await Controller.at(await strategy.controller()))
  //     .vaults(revenueToken.address);
  //
  //   expect(invalidVault).to.be.equal(ZERO_ADDRESS);
  //
  //   await strategy.setController(controller.address, {from: governance});
  //
  //   const transferCalldata = revenueToken.contract
  //     .methods.transfer(miris, 0).encodeABI();
  //
  //   await mock.givenMethodReturnBool(transferCalldata, false);
  //
  //   await expectRevert(controller.withdraw(revenueToken.address, toWithdraw),
  //     "!transferStrategy");
  // });
  //
  // it('should set one split parts', async () => {
  //   const oldParts = await controller.parts();
  //   await expectRevert(controller.setParts(oldParts), '!old');
  //   const newParts = new BN('10');
  //   await controller.setParts(newParts, {from: governance});
  //   expect(await controller.parts()).to.be.bignumber.equal(newParts);
  // });
  //
  // it('should set treasury address', async () => {
  //   await expectRevert(controller.setRewards(ZERO_ADDRESS), '!treasury');
  //   await expectRevert(controller.setRewards(miris), '!contract');
  //   await expectRevert(controller.setRewards(await controller.rewards()), '!old');
  //   const newTreasury = mock.address;
  //   await controller.setRewards(newTreasury, {from: governance});
  //   expect(await controller.rewards()).to.be.bignumber.equal(_newTreasury);
  // });
  //
  // it('should set one split address', async () => {
  //   await expectRevert(controller.setOneSplit(await controller.oneSplit()), '!old');
  //   const newOneSplit = mock.address;
  //   await controller.setOneSplit(_newOneSplit);
  //   expect(await controller.oneSplit()).to.be.equal(newOneSplit);
  // });
  //
  // it('should set strategist address', async () => {
  //   await expectRevert(controller.setStrategist(miris), '!old');
  //   const newStrategist = miris;
  //   await controller.setStrategist(newStrategist);
  //   expect(await controller.strategist()).to.be.equal(newStrategist);
  // });
  //
  // it('should get treasury address', async () => {
  //   // it could be any contract address, I just picked up vault randomly
  //   expect(await controller.rewards()).to.be.equal(vault.address);
  // });
  //
  // it('should get vault by token', async () => {
  //   expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
  // });
  //
  // it('should get strategy by token', async () => {
  //   expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
  // });
  //
  //
  // it('should set vault by token', async () => {
  //   await expectRevert(controller.setVault(revenueToken.address, ZERO_ADDRESS), '!vault 0');
  //   await controller.setVault(revenueToken.address, mock.address);
  //   expect(await controller.vaults(revenueToken.address)).to.be.equal(mock.address);
  // });
  //
  // it('should set converter address', async () => {
  //   const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
  //   await controller.setConverter(revenueToken.address, mockToken.address, mock.address);
  //   expect(await controller.converters(revenueToken.address, mockToken.address)).to.be.equal(mock.address);
  // });

  // it('should set strategy address', async () => {
  //   await expectRevert(controller.setStrategy(revenueToken.address, mock.address), '!approved');
  //
  //   const transferCalldata = revenueToken.contract
  //     .methods.transfer(miris, 0).encodeABI();
  //   const balanceOfCalldata = revenueToken.contract
  //     .methods.balanceOf(miris).encodeABI();
  //   const mockedBalance = ether('10');
  //
  //   await mock.givenMethodReturnUint(balanceOfCalldata, mockedBalance);
  //   await mock.givenMethodReturnBool(transferCalldata, true);
  //
  //   await controller.setApprovedStrategy(revenueToken.address, mock.address, true);
  //   const receipt = await controller.setStrategy(revenueToken.address, mock.address);
  //   expectEvent(receipt, 'WithdrawToVaultAll', {
  //     _token: revenueToken.address
  //   });
  //   expect(await controller.strategies(revenueToken.address)).to.be.equal(mock.address);
  // });
  //
  // it('should approve strategy address', async () => {
  //   await controller.setApprovedStrategy(revenueToken.address, mock.address, true);
  //   expect(await controller.approvedStrategies(revenueToken.address, mock.address)).to.be.equal(true);
  // });
  //
  // it('should get approved strategy address', async () => {
  //   expect(await controller.approvedStrategies(revenueToken.address, mock.address)).to.be.equal(false);
  // });

  it('should send tokens to the strategy and earn', async () => {
    const mockedBalance = ether('10');
    const sumToEarn = ether('1');
    const sumToEarnInRevenueToken = ether('2');

    var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance);

    await expectRevert(controller.earn(mockToken.address, sumToEarn), '!converter');

    await controller.setConverter(mockToken.address, revenueToken.address, mock.address);
    await expectRevert(controller.earn(mockToken.address, sumToEarn), '!transferConverterToken');

    await mockToken.approve(controller.address, sumToEarn, {from: miris});
    await mockToken.transfer(controller.address, sumToEarn, {from: miris});

    const converterCalldata = (await IConverter.at(mock.address)).contract
      .methods.convert(strategy.address).encodeABI();

    await mock.givenCalldataReturnUint(converterCalldata, sumToEarnInRevenueToken);

    const transferCalldata = revenueToken.contract
      .methods.transfer(strategy.address, sumToEarnInRevenueToken).encodeABI();

    await mock.givenCalldataReturnBool(transferCalldata, false);
    await expectRevert(controller.earn(mockToken.address, sumToEarn), '!transferStrategyWant');

    await expectRevert(controller.earn(revenueToken.address, sumToEarnInRevenueToken), '!transferStrategyToken');

    await mock.givenCalldataReturnBool(transferCalldata, true);
    await expectRevert(controller.earn(revenueToken.address, sumToEarnInRevenueToken), 'Not implemented');
  });

  it('should harvest tokens from the strategy', async () => {

  });

});
