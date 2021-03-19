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
const { ZERO } = require('../utils/common');
const { vaultInfrastructureRedeploy } = require('../utils/vault_infrastructure_redeploy');

const IController = artifacts.require("IController");
const IERC20 = artifacts.require("IERC20");

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
    });

    it('should withdraw the amount of \"want\" token', async () => {
      const mockedBalance = ether('10');
      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!controller|vault");
      await strategy.setController(mock.address);
      await strategy.setVault(governance);
      const vaultsCalldata = (await IController.at(mock.address)).contract
        .methods.vaults(revenueToken.address).encodeABI();
      await mock.givenCalldataReturnAddress(vaultsCalldata, ZERO_ADDRESS);

      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!vault");

      await mock.givenCalldataReturnAddress(vaultsCalldata, vault.address);

      const transferCallback = revenueToken.contract
        .methods.transfer(miris, 0).encodeABI();
      await mock.givenMethodReturnBool(transferCallback, false);

      await expectRevert(strategy.methods["withdraw(uint256)"](mockedBalance), "!transferStrategy");
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
