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

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const IController = artifacts.require("IController");
const IERC20 = artifacts.require("IERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');
const IConverter = artifacts.require('IConverter');
const IOneSplitAudit = artifacts.require('IOneSplitAudit');
const Registry = artifacts.require('Registry');
const IVaultCore = artifacts.require('IVaultCore');

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

  beforeEach(async () => {
    [mock, controller, strategy, vault, revenueToken] = await vaultInfrastructureRedeploy(
      governance,
      strategist
    );
    registry = await Registry.new();
  });

  it('should get name of the registry', async () => {
    expect(await registry.getName()).to.be.equal("Registry");
  });

  // function addVault(address _vault) public onlyGovernance {
  //     _addVault(_vault);
  //     (address controller, , , , ) = _getVaultData(_vault);
  //     _addController(controller);
  // }
  it('should revert if try add non-contract or clone-contract vault', async () => {
    await expectRevert(registry.addVault(miris), "!contract");
    expect(await registry.isDelegatedVault(vault.address)).to.be.equal(false);
    expect(await registry.wrappedVaults(vault.address)).to.be.equal(ZERO_ADDRESS);
    console.log(vault.address);
    console.log(await (await IController.at(await vault.controller())).vaults(vault.address))
    await registry.addVault(vault.address);
    await expectRevert(registry.addVault(vault.address), "exists");
  });

  it('should revert if try add and controllers entry about vault is not as given', async () => {
    const secondMock = await MockContract.new();
    const thirdMock = await MockContract.new();
    const mockToken = await MockContract.new();

    const getControllerCalldata = (await IVaultCore.at(secondMock.address)).contract
      .methods.controller().encodeABI();
    await secondMock.givenCalldataReturnAddress(getControllerCalldata, thirdMock.address);

    const getTokenCalldata = (await IVaultCore.at(secondMock.address)).contract
      .methods.token().encodeABI();
    await secondMock.givenCalldataReturnAddress(getTokenCalldata, mockToken.address);

    const getVaultsCalldata = (await IController.at(thirdMock.address)).contract
      .methods.vaults(mockToken.address).encodeABI();
    await thirdMock.givenCalldataReturnAddress(getVaultsCalldata, thirdMock.address);
    await expectRevert(registry.addVault(secondMock.address), "!controllerVaultMatch");
  });

  // // function addWrappedVault(address _vault) public onlyGovernance {
  // //     addVault(_vault);
  // //     address _wrappedVault = IVaultWrapped(_vault).vault();
  // //
  // //     require(_wrappedVault.isContract(), "!contract");
  // //     wrappedVaults[_vault] = _wrappedVault;
  // //
  // //     (address controller, , , , ) = _getVaultData(_vault);
  // //
  // //     // Adds to controllers array
  // //     _addController(controller);
  // //     // TODO Add and track tokens and strategies? [historical]
  // //     // (current ones can be obtained via getVaults + getVaultInfo)
  // // }
  // it('should add wrapped vault properly', async () => {
  //
  // });
  //
  // // function addDelegatedVault(address _vault) public onlyGovernance {
  // //     addVault(_vault);
  // //     isDelegatedVault[_vault] = true;
  // //     (address controller, , , , ) = _getVaultData(_vault);
  // //     // Adds to controllers array
  // //     _addController(controller);
  // //     // TODO Add and track tokens and strategies? [historical]
  // //     // (current ones can be obtained via getVaults + getVaultInfo)
  // // }
  // it('should add delegated vault properly', async () => {
  //
  // });
  //
  // // function removeVault(address _vault) public onlyGovernance {
  // //     _vaults.remove(_vault);
  // // }
  // it('should remove vault properly', async () => {
  //
  // });
  //
  // // Vaults getters
  // // function getVault(uint256 index) external view returns(address vault) {
  // //     return _vaults.at(index);
  // // }
  // it('should get vault properly', async () => {
  //
  // });
  //
  // // function getVaultsLength() external view returns(uint256) {
  // //     return _vaults.length();
  // // }
  // it('should get vaults length properly', async () => {
  //
  // });
  //
  // // function getVaults() external view returns(address[] memory) {
  // //     address[] memory vaultsArray = new address[](_vaults.length());
  // //     for (uint256 i = 0; i < _vaults.length(); i++) {
  // //         vaultsArray[i] = _vaults.at(i);
  // //     }
  // //     return vaultsArray;
  // // }
  // it('should return vaults array (address array)', async () => {
  //
  // });
  //
  // // function getVaultInfo(address _vault)
  // //     external
  // //     view
  // //     returns (
  // //         address controller,
  // //         address token,
  // //         address strategy,
  // //         bool isWrapped,
  // //         bool isDelegated
  // //     )
  // // {
  // //     (controller, token, strategy, isWrapped, isDelegated) = _getVaultData(_vault);
  // //     return (controller, token, strategy, isWrapped, isDelegated);
  // // }
  // it('should get info of a vault', async () => {
  //
  // });
  //
  // // function getVaultsInfo()
  // //     external
  // //     view
  // //     returns (
  // //         address[] memory vaultsAddresses,
  // //         address[] memory controllerArray,
  // //         address[] memory tokenArray,
  // //         address[] memory strategyArray,
  // //         bool[] memory isWrappedArray,
  // //         bool[] memory isDelegatedArray
  // //     )
  // // {
  // //     vaultsAddresses = new address[](_vaults.length());
  // //     controllerArray = new address[](_vaults.length());
  // //     tokenArray = new address[](_vaults.length());
  // //     strategyArray = new address[](_vaults.length());
  // //     isWrappedArray = new bool[](_vaults.length());
  // //     isDelegatedArray = new bool[](_vaults.length());
  // //
  // //     for (uint256 i = 0; i < _vaults.length(); i++) {
  // //         vaultsAddresses[i] = _vaults.at(i);
  // //         (address _controller, address _token, address _strategy, bool _isWrapped, bool _isDelegated) = _getVaultData(_vaults.at(i));
  // //         controllerArray[i] = _controller;
  // //         tokenArray[i] = _token;
  // //         strategyArray[i] = _strategy;
  // //         isWrappedArray[i] = _isWrapped;
  // //         isDelegatedArray[i] = _isDelegated;
  // //     }
  // // }
  // it('should get vaults info', async () => {
  //
  // });

});
