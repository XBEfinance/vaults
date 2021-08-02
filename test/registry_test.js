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
const { ZERO, ONE } = require('./utils/common');

const artifacts = require('./utils/artifacts');
const common = require('./utils/common');
const utilsConstants = require('./utils/constants');
const environment = require('./utils/environment');
const { people, setPeople } = require('./utils/accounts');

// const { vaultInfrastructureRedeploy } = require('./utils/vault_infrastructure_redeploy');

contract('Registry', (accounts) => {

  setPeople(accounts);

  let revenueToken;
  let controller;
  let strategy;
  let vault;
  let mock;
  let registry;
  let mockLpSushi;

  const addVaults = async () => {
    const vaults = [vault.address];
    for (i = 0; i < vaults.length; i++) {
        await registry.addVault(vaults[i], {from: people.owner});
    }
    return vaults;
  }

  beforeEach(async () => {
    [
      mock,
      revenueToken,
      mockLpSushi,
      controller,
      vault,
      strategy,
      registry
    ] = await environment.getGroup(
      [
        "MockContract",
        "MockXBE",
        "Treasury",
        "MockLPSushi",
        "Controller",
        "SushiVault",
        "SushiStrategy",
        "TokenWrapper",
        "Registry"
      ],
      (key) => {
        return [
          "MockContract",
          "MockXBE",
          "MockLPSushi",
          "Controller",
          "SushiVault",
          "SushiStrategy",
          "TokenWrapper",
          "Registry"
        ].includes(key);
      },
      true,
      {
        "SushiVault": {
          5: ZERO_ADDRESS
        },
        "Treasury": {
          1: ZERO_ADDRESS
        }
      }
    );
    // [mock, controller, strategy, vault, revenueToken] = await vaultInfrastructureRedeploy(
    //   people.owner,
    //   people.bob,
    //   InstitutionalEURxbStrategy,
    //   InstitutionalEURxbVault
    // );
    // registry = await Registry.new({from: people.owner});
    // wrapper = await TokenWrapper.new(
    //   "Banked EURxb",
    //   "bEURxb",
    //   revenueToken.address,
    //   people.owner,
    //   {from: people.owner}
    // );
    // await vault.configure(
    //     wrapper.address,
    //     controller.address,
    //     revenueToken.address,
    //     {from: people.owner}
    // );
    // await controller.setVault(wrapper.address, vault.address, {from: people.owner});
    // await strategy.setWant(wrapper.address, {from: people.owner});
    // await controller.setApprovedStrategy(
    //   wrapper.address,
    //   strategy.address,
    //   true,
    //   {from: people.owner}
    // );
    // await controller.setStrategy(wrapper.address, strategy.address, {from: people.owner});
  });

  it('should get name of the registry', async () => {
    expect(await registry.getName()).to.be.equal("Registry");
  });

  it('should revert if try add non-contract or clone-contract vault', async () => {
    await expectRevert(registry.addVault(people.alice, {from: people.owner}), "!contract");
    expect(await registry.isDelegatedVault(vault.address)).to.be.equal(false);
    expect(await registry.wrappedVaults(vault.address)).to.be.equal(ZERO_ADDRESS);
    await registry.addVault(vault.address, {from: people.owner});
    await expectRevert(registry.addVault(vault.address, {from: people.owner}), "exists");
  });

  it('should revert if try add and controllers entries are not as given', async () => {
    const secondMock = await artifacts.MockContract.new();
    const thirdMock = await artifacts.MockContract.new();
    const mockToken = await artifacts.MockContract.new();
    const otherMockToken = await artifacts.MockContract.new();

    const getControllerCalldata = (await artifacts.IVaultCore.at(secondMock.address)).contract
      .methods.controller().encodeABI();
    await secondMock.givenCalldataReturnAddress(getControllerCalldata, thirdMock.address);

    const getTokenCalldata = (await artifacts.IVaultCore.at(secondMock.address)).contract
      .methods.token().encodeABI();
    await secondMock.givenCalldataReturnAddress(getTokenCalldata, mockToken.address);

    let getVaultsCalldata = (await artifacts.IController.at(thirdMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getVaultsCalldata, thirdMock.address);

    await expectRevert(registry.addVault(secondMock.address, {from: people.owner}), "!controllerVaultMatch");

    getVaultsCalldata = (await artifacts.IController.at(thirdMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getVaultsCalldata, secondMock.address);

    const getStrategiesCalldata = (await artifacts.IController.at(thirdMock.address)).contract
      .methods.strategies(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getStrategiesCalldata, mock.address);

    const wantCalldata = (await artifacts.IStrategy.at(mock.address)).contract
      .methods.want().encodeABI();
    await mock.givenCalldataReturnAddress(wantCalldata, otherMockToken.address);

    await expectRevert(registry.addVault(secondMock.address, {from: people.owner}), "!strategyTokenMatch");
  });

  const setupVaultMock = async (addImmidieately, defaultControllerMock=null) => {
    const vaultMock = await artifacts.MockContract.new();
    const strategyMock = await artifacts.MockContract.new();
    const controllerMock = defaultControllerMock ? defaultControllerMock : await artifacts.MockContract.new();
    const mockToken = await artifacts.MockContract.new();

    const getControllerCalldata = (await artifacts.IVaultCore.at(vaultMock.address)).contract
      .methods.controller().encodeABI();
    await vaultMock.givenCalldataReturnAddress(getControllerCalldata, controllerMock.address);

    const getTokenCalldata = (await artifacts.IVaultCore.at(vaultMock.address)).contract
      .methods.token().encodeABI();
    await vaultMock.givenCalldataReturnAddress(getTokenCalldata, mockToken.address);

    const getVaultsCalldata = (await artifacts.IController.at(controllerMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(getVaultsCalldata, vaultMock.address);

    const getStrategiesCalldata = (await artifacts.IController.at(controllerMock.address)).contract
      .methods.strategies(mockToken.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(getStrategiesCalldata, strategyMock.address);

    const wantCalldata = (await artifacts.IStrategy.at(strategyMock.address)).contract
      .methods.want().encodeABI();
    await strategyMock.givenCalldataReturnAddress(wantCalldata, mockToken.address);

    if (addImmidieately) {
      await registry.addVault(vaultMock.address);
    }

    return [vaultMock, strategyMock, controllerMock, mockToken];
  };

  it('should add wrapped vault properly', async () => {

    let _, firstVault;

    [firstVault, _, _, _] = await setupVaultMock(false);

    const wrappedVaultsCalldata = (await artifacts.IVaultWrapped.at(firstVault.address)).contract
      .methods.vault().encodeABI();
    await firstVault.givenCalldataReturnAddress(wrappedVaultsCalldata, people.alice);

    await expectRevert(registry.addWrappedVault(firstVault.address, {from: people.owner}), "!contractWrapped");

    await firstVault.givenCalldataReturnAddress(wrappedVaultsCalldata, firstVault.address);

    // The test is wrap vault into itself
    await registry.addWrappedVault(firstVault.address, {from: people.owner});
    expect(await registry.wrappedVaults(firstVault.address)).to.be.equal(firstVault.address);
  });

  it('should add vault with same controller', async () => {
    let _;
    let firstVaultMock;
    let firstStrategyMock;
    let mockToken;

    let secondVaultMock;
    let secondStrategyMock;
    let otherMockToken;

    let controllerMock = await artifacts.MockContract.new();

    [firstVaultMock, firstStrategyMock, _, mockToken] = await setupVaultMock(false, controllerMock);
    [secondVaultMock, secondStrategyMock, _, otherMockToken] = await setupVaultMock(false, controllerMock);

    const getControllerCalldata = (await artifacts.IVaultCore.at(firstVaultMock.address)).contract
      .methods.controller().encodeABI();

    await firstVaultMock.givenCalldataReturnAddress(getControllerCalldata, controllerMock.address);
    await secondVaultMock.givenCalldataReturnAddress(getControllerCalldata, controllerMock.address);

    await registry.addVault(firstVaultMock.address, {from: people.owner});
    await registry.addVault(secondVaultMock.address, {from: people.owner});

    const controllersLength = await registry.getControllersLength();
    console.log(controllersLength);
    expect(controllersLength).to.be.bignumber.equal(ONE);
  });

  it('should get vault stats if vault is wrapped', async () => {
    let vaultMock;
    let strategyMock;
    let mockToken;
    let controllerMock;

    [vaultMock, strategyMock, controllerMock, mockToken] = await setupVaultMock(false);

    const wrappedVaultsCalldata = (await artifacts.IVaultWrapped.at(vaultMock.address)).contract
      .methods.vault().encodeABI();
    await vaultMock.givenCalldataReturnAddress(wrappedVaultsCalldata, vaultMock.address);


    const underlyingVaultCalldata = (await artifacts.IVaultDelegated.at(vaultMock.address)).contract
      .methods.underlying().encodeABI();

    await vaultMock.givenCalldataReturnAddress(underlyingVaultCalldata, mockToken.address);

    await registry.addWrappedVault(vaultMock.address, {from: people.owner});

    await vaultMock.givenCalldataReturnAddress(underlyingVaultCalldata, ZERO_ADDRESS);

    await expectRevert(registry.getVaultInfo(vaultMock.address), "!wrappedTokenMatch");

    await vaultMock.givenCalldataReturnAddress(underlyingVaultCalldata, mockToken.address);

    const result = await registry.getVaultInfo(vaultMock.address);
    expect(result.isWrapped).to.be.equal(true);
  });

  it('should get vault stats if vault is delegated', async () => {
    let vaultMock;
    let strategyMock;
    let mockToken;
    let controllerMock;

    [vaultMock, strategyMock, controllerMock, mockToken] = await setupVaultMock(false);

    const controllerStrategyCalldata = (await artifacts.IController.at(controllerMock.address)).contract
      .methods.strategies(vaultMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(controllerStrategyCalldata, strategyMock.address);

    const vaultsStrategyCalldata = (await artifacts.IController.at(controllerMock.address)).contract
      .methods.vaults(strategyMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(vaultsStrategyCalldata, vaultMock.address);

    await registry.addDelegatedVault(vaultMock.address, {from: people.owner});


    const result = await registry.getVaultInfo(vaultMock.address);

    expect(result.isDelegated).to.be.equal(true);
  });

  it('should get vault stats if vault is delegated', async () => {
    let vaultMock;
    let strategyMock;
    let mockToken;
    let controllerMock;

    [vaultMock, strategyMock, controllerMock, mockToken] = await setupVaultMock(false);

    const controllerStrategyCalldata = (await artifacts.IController.at(controllerMock.address)).contract
      .methods.strategies(vaultMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(controllerStrategyCalldata, strategyMock.address);

    const vaultsStrategyCalldata = (await artifacts.IController.at(controllerMock.address)).contract
      .methods.vaults(strategyMock.address).encodeABI();
    await controllerMock.givenCalldataReturnAddress(vaultsStrategyCalldata, vaultMock.address);

    await registry.addDelegatedVault(vaultMock.address, {from: people.owner});

    const result = await registry.getVaultInfo(vaultMock.address);

    expect(result.isDelegated).to.be.equal(true);
  });


  it('should add delegated vault properly', async () => {
    await registry.addDelegatedVault(vault.address, {from: people.owner});
    expect(await registry.isDelegatedVault(vault.address)).to.be.equal(true);
  });

  it('should remove vault properly', async () => {
    await registry.addVault(vault.address, {from: people.owner});
    await registry.removeVault(vault.address, {from: people.owner});
    const result = await registry.getVaultsLength();
    console.log(result);
    expect(result).to.be.bignumber.equal(ZERO);
  });

  it('should get vault properly', async () => {
    await registry.addVault(vault.address, {from: people.owner});
    expect(await registry.getVault(ZERO)).to.be.equal(vault.address);
  });

  it('should get controller properly', async () => {
    await registry.addVault(vault.address, {from: people.owner});
    expect(await registry.getController(ZERO)).to.be.equal(controller.address);
  });

  it('should get vaults set length properly', async () => {
    await registry.addVault(vault.address, {from: people.owner});
    expect(await registry.getVaultsLength()).to.be.bignumber.equal(ONE);
  });

  it('should get controllers set length properly', async () => {
    await registry.addVault(vault.address, {from: people.owner});
    expect(await registry.getControllersLength()).to.be.bignumber.equal(ONE);
  });

  it('should return vaults array (address array)', async () => {
    const vaults = await addVaults();
    const actualVaults = await registry.getVaults();
    expect(actualVaults.length).to.be.equal(vaults.length);
    for (let i = 0; i < actualVaults.length; i++) {
        expect(actualVaults[i]).to.be.equal(vaults[i]);
    }
  });

  it('should get info of a vault', async () => {
    const vaults = await addVaults();
    for (let i = 0; i < vaults.length; i++) {
      const vaultInfo = await registry.getVaultInfo(vaults[i]);
      expect(vaultInfo[0]).to.be.equal(controller.address);
      expect(vaultInfo[1]).to.be.equal(mockLpSushi.address);
      expect(vaultInfo[2]).to.be.equal(strategy.address);
      expect(vaultInfo[3]).to.be.equal(false);
      expect(vaultInfo[4]).to.be.equal(false);
    }
  });

  it('should get vaults info', async () => {
    const vaults = await addVaults();
    const vaultsInfo = await registry.getVaultsInfo();
    for (let i = 0; i < vaults.length; i++) {
      expect(vaultsInfo[0][i]).to.be.equal(vaults[i]);
      expect(vaultsInfo[1][i]).to.be.equal(controller.address);
      expect(vaultsInfo[2][i]).to.be.equal(mockLpSushi.address);
      expect(vaultsInfo[3][i]).to.be.equal(strategy.address);
      expect(vaultsInfo[4][i]).to.be.equal(false);
      expect(vaultsInfo[5][i]).to.be.equal(false);
    }
  });

});
