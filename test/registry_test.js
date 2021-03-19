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
const { ZERO, ONE, getMockTokenPrepared } = require('./utils/common');
const { vaultInfrastructureRedeploy } = require('./utils/vault_infrastructure_redeploy');

const IController = artifacts.require("IController");
const IERC20 = artifacts.require("IERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');
const IConverter = artifacts.require('IConverter');
const IOneSplitAudit = artifacts.require('IOneSplitAudit');
const Registry = artifacts.require('Registry');
const IVaultCore = artifacts.require('IVaultCore');
const IVaultWrapped = artifacts.require('IVaultWrapped');

const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");

const MockContract = artifacts.require("MockContract");

contract('Registry', (accounts) => {

  const governance = accounts[0];
  const miris = accounts[1];
  const strategist = accounts[2];

  var revenueToken;
  var controller;
  var strategy;
  var vault;
  var mock;
  var registry;

  const addVaults = async () => {
    const vaults = [vault.address];
    for (i = 0; i < vaults.length; i++) {
        await registry.addVault(vaults[i]);
    }
    return vaults;
  }

  beforeEach(async () => {
    [mock, controller, strategy, vault, revenueToken] = await vaultInfrastructureRedeploy(
      governance,
      strategist,
      InstitutionalEURxbStrategy,
      InstitutionalEURxbVault
    );
    registry = await Registry.new();
  });

  it('should get name of the registry', async () => {
    expect(await registry.getName()).to.be.equal("Registry");
  });

  it('should revert if try add non-contract or clone-contract vault', async () => {
    await expectRevert(registry.addVault(miris), "!contract");
    expect(await registry.isDelegatedVault(vault.address)).to.be.equal(false);
    expect(await registry.wrappedVaults(vault.address)).to.be.equal(ZERO_ADDRESS);
    await registry.addVault(vault.address);
    await expectRevert(registry.addVault(vault.address), "exists");
  });

  it('should revert if try add and controllers entries are not as given', async () => {
    const secondMock = await MockContract.new();
    const thirdMock = await MockContract.new();
    const mockToken = await MockContract.new();
    const otherMockToken = await MockContract.new();

    const getControllerCalldata = (await IVaultCore.at(secondMock.address)).contract
      .methods.controller().encodeABI();
    await secondMock.givenCalldataReturnAddress(getControllerCalldata, thirdMock.address);

    const getTokenCalldata = (await IVaultCore.at(secondMock.address)).contract
      .methods.token().encodeABI();
    await secondMock.givenCalldataReturnAddress(getTokenCalldata, mockToken.address);

    var getVaultsCalldata = (await IController.at(thirdMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getVaultsCalldata, thirdMock.address);

    await expectRevert(registry.addVault(secondMock.address), "!controllerVaultMatch");

    getVaultsCalldata = (await IController.at(thirdMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getVaultsCalldata, secondMock.address);

    const getStrategiesCalldata = (await IController.at(thirdMock.address)).contract
      .methods.strategies(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getStrategiesCalldata, mock.address);

    const wantCalldata = (await IStrategy.at(mock.address)).contract
      .methods.want().encodeABI();
    await mock.givenCalldataReturnAddress(wantCalldata, otherMockToken.address);

    await expectRevert(registry.addVault(secondMock.address), "!strategyTokenMatch");
  });

  it('should add wrapped vault properly', async () => {

    const secondMock = await MockContract.new();
    const thirdMock = await MockContract.new();
    const mockToken = await MockContract.new();
    const otherMockToken = await MockContract.new();

    const getControllerCalldata = (await IVaultCore.at(secondMock.address)).contract
      .methods.controller().encodeABI();
    await secondMock.givenCalldataReturnAddress(getControllerCalldata, thirdMock.address);

    const getTokenCalldata = (await IVaultCore.at(secondMock.address)).contract
      .methods.token().encodeABI();
    await secondMock.givenCalldataReturnAddress(getTokenCalldata, mockToken.address);

    var getVaultsCalldata = (await IController.at(thirdMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getVaultsCalldata, secondMock.address);

    const getStrategiesCalldata = (await IController.at(thirdMock.address)).contract
      .methods.strategies(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getStrategiesCalldata, mock.address);

    const wantCalldata = (await IStrategy.at(mock.address)).contract
      .methods.want().encodeABI();
    await mock.givenCalldataReturnAddress(wantCalldata, mockToken.address);

    var wrappedVaultsCalldata = (await IVaultWrapped.at(secondMock.address)).contract
      .methods.vault().encodeABI();
    await secondMock.givenCalldataReturnAddress(wrappedVaultsCalldata, miris);

    await expectRevert(registry.addWrappedVault(secondMock.address), "!contractWrapped");

    wrappedVaultsCalldata = (await IVaultWrapped.at(secondMock.address)).contract
      .methods.vault().encodeABI();
    await secondMock.givenCalldataReturnAddress(wrappedVaultsCalldata, secondMock.address);

    // The test is temporary wrap itself
    await registry.addWrappedVault(secondMock.address);
    expect(await registry.wrappedVaults(secondMock.address)).to.be.equal(secondMock.address);
  });

  it('should add delegated vault properly', async () => {
    await registry.addDelegatedVault(vault.address);
    expect(await registry.isDelegatedVault(vault.address)).to.be.equal(true);
  });

  it('should remove vault properly', async () => {
    await registry.addVault(vault.address);
    await registry.removeVault(vault.address);
    expect(await registry.getVaultsLength()).to.be.bignumber.equal(ZERO);
  });

  it('should get vault properly', async () => {
    await registry.addVault(vault.address);
    expect(await registry.getVault(ZERO)).to.be.equal(vault.address);
  });

  it('should get vaults length properly', async () => {
    await registry.addVault(vault.address);
    expect(await registry.getVaultsLength()).to.be.bignumber.equal(ONE);
  });

  it('should return vaults array (address array)', async () => {
    const vaults = await addVaults();
    const actualVaults = await registry.getVaults();
    expect(actualVaults.length).to.be.equal(vaults.length);
    for (var i = 0; i < actualVaults.length; i++) {
        expect(actualVaults[i]).to.be.equal(vaults[i]);
    }
  });

  it('should get info of a vault', async () => {
    const vaults = await addVaults();
    for (var i = 0; i < vaults.length; i++) {
      const vaultInfo = await registry.getVaultInfo(vaults[i]);
      expect(vaultInfo[0]).to.be.equal(controller.address);
      expect(vaultInfo[1]).to.be.equal(revenueToken.address);
      expect(vaultInfo[2]).to.be.equal(strategy.address);
      expect(vaultInfo[3]).to.be.equal(false);
      expect(vaultInfo[4]).to.be.equal(false);
    }
  });

  it('should get vaults info', async () => {
    const vaults = await addVaults();
    const vaultsInfo = await registry.getVaultsInfo();
    for (var i = 0; i < vaults.length; i++) {
      expect(vaultsInfo[0][i]).to.be.equal(vaults[i]);
      expect(vaultsInfo[1][i]).to.be.equal(controller.address);
      expect(vaultsInfo[2][i]).to.be.equal(revenueToken.address);
      expect(vaultsInfo[3][i]).to.be.equal(strategy.address);
      expect(vaultsInfo[4][i]).to.be.equal(false);
      expect(vaultsInfo[5][i]).to.be.equal(false);
    }
  });

});
