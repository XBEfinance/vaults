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
const IVaultDelegated = artifacts.require('IVaultDelegated');

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

  const setupVaultMock = async (addImmidieately, defaultControllerMock=null) => {
    const vaultMock = await MockContract.new();
    const strategyMock = await MockContract.new();
    const controllerMock = defaultControllerMock ? defaultControllerMock : await MockContract.new();
    const mockToken = await MockContract.new();

    const getControllerCalldata = (await IVaultCore.at(vaultMock.address)).contract
      .methods.controller().encodeABI();
    await vaultMock.givenCalldataReturnAddress(getControllerCalldata, controllerMock.address);

    const getTokenCalldata = (await IVaultCore.at(vaultMock.address)).contract
      .methods.token().encodeABI();
    await vaultMock.givenCalldataReturnAddress(getTokenCalldata, mockToken.address);

    const getVaultsCalldata = (await IController.at(controllerMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(getVaultsCalldata, vaultMock.address);

    const getStrategiesCalldata = (await IController.at(controllerMock.address)).contract
      .methods.strategies(mockToken.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(getStrategiesCalldata, strategyMock.address);

    const wantCalldata = (await IStrategy.at(strategyMock.address)).contract
      .methods.want().encodeABI();
    await strategyMock.givenCalldataReturnAddress(wantCalldata, mockToken.address);

    if (addImmidieately) {
      await registry.addVault(vaultMock.address);
    }

    return [vaultMock, strategyMock, controllerMock, mockToken];
  };

  it('should add wrapped vault properly', async () => {

    var _, firstVault;

    [firstVault, _, _, _] = await setupVaultMock(false);

    const wrappedVaultsCalldata = (await IVaultWrapped.at(firstVault.address)).contract
      .methods.vault().encodeABI();
    await firstVault.givenCalldataReturnAddress(wrappedVaultsCalldata, miris);

    await expectRevert(registry.addWrappedVault(firstVault.address), "!contractWrapped");

    await firstVault.givenCalldataReturnAddress(wrappedVaultsCalldata, firstVault.address);

    // The test is wrap vault into itself
    await registry.addWrappedVault(firstVault.address);
    expect(await registry.wrappedVaults(firstVault.address)).to.be.equal(firstVault.address);
  });

  it('should add vault with same controller', async () => {
    var _;
    var firstVaultMock;
    var firstStrategyMock;
    var mockToken;

    var secondVaultMock;
    var secondStrategyMock;
    var otherMockToken;

    var controllerMock = await MockContract.new();

    [firstVaultMock, firstStrategyMock, _, mockToken] = await setupVaultMock(false, controllerMock);
    [secondVaultMock, secondStrategyMock, _, otherMockToken] = await setupVaultMock(false, controllerMock);


    const getControllerCalldata = (await IVaultCore.at(firstVaultMock.address)).contract
      .methods.controller().encodeABI();

    await firstVaultMock.givenCalldataReturnAddress(getControllerCalldata, controllerMock.address);
    await secondVaultMock.givenCalldataReturnAddress(getControllerCalldata, controllerMock.address);

    await registry.addVault(firstVaultMock.address);
    await registry.addVault(secondVaultMock.address);

    expect(await registry.getControllersLength()).to.be.bignumber.equal(ONE);
  });

  it('should get vault stats if vault is wrapped', async () => {
    var vaultMock;
    var strategyMock;
    var mockToken;
    var controllerMock;

    [vaultMock, strategyMock, controllerMock, mockToken] = await setupVaultMock(false);

    const wrappedVaultsCalldata = (await IVaultWrapped.at(vaultMock.address)).contract
      .methods.vault().encodeABI();
    await vaultMock.givenCalldataReturnAddress(wrappedVaultsCalldata, vaultMock.address);


    const underlyingVaultCalldata = (await IVaultDelegated.at(vaultMock.address)).contract
      .methods.underlying().encodeABI();

    await vaultMock.givenCalldataReturnAddress(underlyingVaultCalldata, mockToken.address);

    await registry.addWrappedVault(vaultMock.address);

    await vaultMock.givenCalldataReturnAddress(underlyingVaultCalldata, ZERO_ADDRESS);

    await expectRevert(registry.getVaultInfo(vaultMock.address), "!wrappedTokenMatch");

    await vaultMock.givenCalldataReturnAddress(underlyingVaultCalldata, mockToken.address);

    const result = await registry.getVaultInfo(vaultMock.address);
    expect(result.isWrapped).to.be.equal(true);
  });

  it('should get vault stats if vault is delegated', async () => {
    var vaultMock;
    var strategyMock;
    var mockToken;
    var controllerMock;

    [vaultMock, strategyMock, controllerMock, mockToken] = await setupVaultMock(false);

    const controllerStrategyCalldata = (await IController.at(controllerMock.address)).contract
      .methods.strategies(vaultMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(controllerStrategyCalldata, strategyMock.address);

    const vaultsStrategyCalldata = (await IController.at(controllerMock.address)).contract
      .methods.vaults(strategyMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(vaultsStrategyCalldata, vaultMock.address);

    await registry.addDelegatedVault(vaultMock.address);


    const result = await registry.getVaultInfo(vaultMock.address);

    expect(result.isDelegated).to.be.equal(true);
  });

  it('should get vault stats if vault is delegated', async () => {
    var vaultMock;
    var strategyMock;
    var mockToken;
    var controllerMock;

    [vaultMock, strategyMock, controllerMock, mockToken] = await setupVaultMock(false);

    const controllerStrategyCalldata = (await IController.at(controllerMock.address)).contract
      .methods.strategies(vaultMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(controllerStrategyCalldata, strategyMock.address);

    const vaultsStrategyCalldata = (await IController.at(controllerMock.address)).contract
      .methods.vaults(strategyMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(vaultsStrategyCalldata, vaultMock.address);

    await registry.addDelegatedVault(vaultMock.address);

    const result = await registry.getVaultInfo(vaultMock.address);

    expect(result.isDelegated).to.be.equal(true);
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

  it('should get controller properly', async () => {
    await registry.addVault(vault.address);
    expect(await registry.getController(ZERO)).to.be.equal(controller.address);
  });

  it('should get vaults set length properly', async () => {
    await registry.addVault(vault.address);
    expect(await registry.getVaultsLength()).to.be.bignumber.equal(ONE);
  });

  it('should get controllers set length properly', async () => {
    await registry.addVault(vault.address);
    expect(await registry.getControllersLength()).to.be.bignumber.equal(ONE);
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
