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
const { ZERO, ONE } = require('../utils/common');
const { vaultInfrastructureRedeploy } = require('../utils/vault_infrastructure_redeploy');

const IController = artifacts.require("IController");
const IERC20 = artifacts.require("IERC20");
const IConverter = artifacts.require("IConverter");
const IVaultCore = artifacts.require("IVaultCore");

const MockContract = artifacts.require("MockContract");

const strategyTestSuite = (strategyType, vaultType) => {
  return (accounts) => {

    const governance = accounts[0];
    const miris = accounts[1];
    const strategist = accounts[2];

    var revenueToken;
    var controller;
    var strategy;
    var vault;
    var mock;

    beforeEach(async () => {
      // console.log(strategyType);
      [mock, controller, strategy, vault, revenueToken] = await vaultInfrastructureRedeploy(
        governance,
        strategist,
        strategyType,
        vaultType
      );
    });

    it('should configure properly', async () => {
      expect(await strategy.want()).to.be.equal(revenueToken.address);
      expect(await strategy.controller()).to.be.equal(controller.address);
      expect(await strategy.vault()).to.be.equal(vault.address);
    });

    it('should set a new vault', async () => {
      await expectRevert(strategy.setVault(vault.address), "!old");
      await strategy.setVault(mock.address);
      expect(await strategy.vault()).to.be.equal(mock.address);
    });

    it('should set a new want', async () => {
      await expectRevert(strategy.setWant(revenueToken.address), "!old");
      const secondMock = await MockContract.new();
      await strategy.setWant(secondMock.address);
      expect(await strategy.want()).to.be.equal(secondMock.address);
    });

    it('should set a new controller', async () => {
      await expectRevert(strategy.setController(controller.address), "!old");
      await strategy.setController(mock.address);
      expect(await strategy.controller()).to.be.equal(mock.address);
    });

    it('should deposit the balance', async () => {
      await strategy.deposit();
      // await expectRevert(, "Not implemented");
    });

    it('should withdraw the balance of the non-want token', async () => {
      await expectRevert(strategy.withdraw(mock.address), "!controller");
      await strategy.setController(governance);
      await expectRevert(strategy.withdraw(mock.address), "!want");
      const secondMock = await MockContract.new();
      const transferCallback = (await IERC20.at(secondMock.address)).contract
        .methods.transfer(miris, 0).encodeABI();
      await secondMock.givenMethodReturnBool(transferCallback, false);
      await expectRevert(strategy.withdraw(secondMock.address), "!transfer");
      await secondMock.givenMethodReturnBool(transferCallback, true);
      const receipt = await strategy.withdraw(secondMock.address);
      await expectEvent(receipt, "Withdrawn", {
        _token: secondMock.address,
        _amount: ZERO,
        _to: governance
      });
    });

    it('should reject withdraw the amount of \"want\" token if controller is not set up', async () => {
      const mockedBalance = ether('10');
      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!controller|vault");
    });

    it('should reject withdraw the amount of \"want\" token if called not by vault or controller', async () => {
      await expectRevert(strategy.methods["withdraw(uint256)"](ether('10')), "!controller|vault");
    });

    it('should reject withdraw the amount of \"want\" token if vault address is zero', async () => {
      const mockedBalance = ether('10');

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(revenueToken.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, ZERO_ADDRESS);

      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!vault");
    });

    it('should reject withdraw the amount of \"want\" token if transfer to vault failed', async () => {
      const mockedBalance = ether('10');

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(revenueToken.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, vault.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, false);

      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!transferVault");
    });

    it('should reject withdraw the amount of \"want\" token if converter required and it is zero address', async () => {
      const mockedBalance = ether('10');

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const mockWant = await MockContract.new();
      await strategy.setWant(mockWant.address);

      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(mockWant.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, vault.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, true);

      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!converter");

    });

    it('should reject withdraw the amount of \"want\" token if converter required and transfer funds to it failed', async () => {
      const mockedBalance = ether('10');

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const mockWant = await MockContract.new();
      await strategy.setWant(mockWant.address);


      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(mockWant.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, vault.address);

      const converterMock = await MockContract.new();
      const convertersCalldata = (await IController.at(mock.address)).contract
        .methods.converters(revenueToken.address, mockWant.address).encodeABI();
      await mock.givenCalldataReturnAddress(convertersCalldata, converterMock.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, false);

      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!transferConverterToken");
    });

    it('should withdraw the amount of \"want\" token if withdraw from business logic is not required', async () => {
      const mockedBalance = ether('10');

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const mockWant = await MockContract.new();
      await strategy.setWant(mockWant.address);

      const mockWantBalanceOfCalldata = (await IERC20.at(mockWant.address)).contract
        .methods.balanceOf(strategy.address).encodeABI();
      await mockWant.givenCalldataReturnUint(mockWantBalanceOfCalldata, mockedBalance.add(ONE));

      const mockVault = await MockContract.new();

      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(mockWant.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, mockVault.address);

      const tokenCalldata = (await IVaultCore.at(mockVault.address)).contract
        .methods.token().encodeABI();
      await mockVault.givenCalldataReturnAddress(tokenCalldata, mockWant.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, true);

      const transferOfWantMockCallback = (await IERC20.at(mockWant.address)).contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mockWant.givenMethodReturnBool(transferOfWantMockCallback, true);

      const receipt = await strategy.methods["withdraw(uint256)"](mockedBalance);
      await expectEvent(receipt, "Withdrawn", {
        _token: mockWant.address,
        _amount: mockedBalance,
        _to: mockVault.address
      });
    });

    it('should withdraw the amount of \"want\" token if converter required ', async () => {
      const mockedBalance = ether('10');

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const mockWant = await MockContract.new();
      await strategy.setWant(mockWant.address);

      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(mockWant.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, vault.address);

      const converterMock = await MockContract.new();
      const convertersCalldata = (await IController.at(mock.address)).contract
        .methods.converters(revenueToken.address, mockWant.address).encodeABI();
      await mock.givenCalldataReturnAddress(convertersCalldata, converterMock.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, true);

      const convertedBalance = ether('11');
      const convertCalldata = (await IConverter.at(converterMock.address)).contract
        .methods.convert(strategy.address).encodeABI();
      await converterMock.givenCalldataReturnUint(convertCalldata, convertedBalance);

      const transferOfWantMockCallback = (await IERC20.at(mockWant.address)).contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mockWant.givenMethodReturnBool(transferOfWantMockCallback, true);

      const receipt = await strategy.methods["withdraw(uint256)"](mockedBalance);
      await expectEvent(receipt, "Withdrawn", {
        _token: mockWant.address,
        _amount: convertedBalance,
        _to: vault.address
      });
    });


    it('should withdraw the amount of \"want\" token', async () => {
      const mockedBalance = ether('10');

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(revenueToken.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, vault.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, true);

      const receipt = await strategy.methods["withdraw(uint256)"](mockedBalance);
      await expectEvent(receipt, "Withdrawn", {
        _token: revenueToken.address,
        _amount: mockedBalance,
        _to: vault.address
      });
    });

    it('should reject withdraw all the amount of \"want\" token if caller is neither vault nor controller', async () => {
      await expectRevert(strategy.withdrawAll({from: miris}), "!controller|vault");
    });

    it('should withdraw all the amount of \"want\" token', async () => {
      const mockedBalance = ether('10');

      const balanceOfCalldata = revenueToken.contract
        .methods.balanceOf(strategy.address).encodeABI();
      await mock.givenCalldataReturnUint(balanceOfCalldata, mockedBalance);

      await strategy.setController(mock.address);
      await strategy.setVault(governance);

      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(revenueToken.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, vault.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(ZERO_ADDRESS, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, true);

      const receipt = await strategy.withdrawAll();
      await expectEvent(receipt, "Withdrawn", {
        _token: revenueToken.address,
        _amount: mockedBalance,
        _to: vault.address
      });
    });

    it('should skim', async () => {
      await strategy.skim();
    });

    it('should return balance \"want\" token of this contract', async () => {
      const mockedBalance = ether('10');
      const balanceOfCalldata = revenueToken.contract
        .methods.balanceOf(strategy.address).encodeABI();
      await mock.givenCalldataReturnUint(balanceOfCalldata, mockedBalance);
      expect(await strategy.balanceOf()).to.be.bignumber.equal(mockedBalance);
    });

    it('should return withdrawal fee', async () => {
      await strategy.withdrawalFee();
    });

  };
}

module.exports = {
  strategyTestSuite
};
