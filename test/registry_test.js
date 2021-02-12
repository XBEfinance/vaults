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

const {
  actorStake, activeActor, deployAndConfigureGovernance
} = require('./governance_test.js');

const MockContract = artifacts.require("MockContract");

const MockToken = artifacts.require('MockToken');
const ExecutorMock = artifacts.require('ExecutorMock');

contract('Registry', (accounts) => {

  // function configure(
  //         address _governance
  // ) external initializer {
  //     setGovernance(_governance);
  // }
  it('should configure properly', async () => {

  });

  // function getName() external pure returns(string memory) {
  //   return "Registry";
  // }
  it('should get name of the registry', async () => {

  });

  // function addVault(address _vault) public onlyGovernance {
  //     _addVault(_vault);
  //     (address controller, , , , ) = _getVaultData(_vault);
  //     _addController(controller);
  // }
  it('should add vault properly', async () => {

  });

  // function addWrappedVault(address _vault) public onlyGovernance {
  //     addVault(_vault);
  //     address _wrappedVault = IVaultWrapped(_vault).vault();
  //
  //     require(_wrappedVault.isContract(), "!contract");
  //     wrappedVaults[_vault] = _wrappedVault;
  //
  //     (address controller, , , , ) = _getVaultData(_vault);
  //
  //     // Adds to controllers array
  //     _addController(controller);
  //     // TODO Add and track tokens and strategies? [historical]
  //     // (current ones can be obtained via getVaults + getVaultInfo)
  // }
  it('should add wrapped vault properly', async () => {

  });

  // function addDelegatedVault(address _vault) public onlyGovernance {
  //     addVault(_vault);
  //     isDelegatedVault[_vault] = true;
  //     (address controller, , , , ) = _getVaultData(_vault);
  //     // Adds to controllers array
  //     _addController(controller);
  //     // TODO Add and track tokens and strategies? [historical]
  //     // (current ones can be obtained via getVaults + getVaultInfo)
  // }
  it('should add delegated vault properly', async () => {

  });

  // function removeVault(address _vault) public onlyGovernance {
  //     _vaults.remove(_vault);
  // }
  it('should remove vault properly', async () => {

  });

  // Vaults getters
  // function getVault(uint256 index) external view returns(address vault) {
  //     return _vaults.at(index);
  // }
  it('should get vault properly', async () => {

  });

  // function getVaultsLength() external view returns(uint256) {
  //     return _vaults.length();
  // }
  it('should get vaults length properly', async () => {

  });

  // function getVaults() external view returns(address[] memory) {
  //     address[] memory vaultsArray = new address[](_vaults.length());
  //     for (uint256 i = 0; i < _vaults.length(); i++) {
  //         vaultsArray[i] = _vaults.at(i);
  //     }
  //     return vaultsArray;
  // }
  it('should return vaults array (address array)', async () => {

  });

  // function getVaultInfo(address _vault)
  //     external
  //     view
  //     returns (
  //         address controller,
  //         address token,
  //         address strategy,
  //         bool isWrapped,
  //         bool isDelegated
  //     )
  // {
  //     (controller, token, strategy, isWrapped, isDelegated) = _getVaultData(_vault);
  //     return (controller, token, strategy, isWrapped, isDelegated);
  // }
  it('should get info of a vault', async () => {

  });

  // function getVaultsInfo()
  //     external
  //     view
  //     returns (
  //         address[] memory vaultsAddresses,
  //         address[] memory controllerArray,
  //         address[] memory tokenArray,
  //         address[] memory strategyArray,
  //         bool[] memory isWrappedArray,
  //         bool[] memory isDelegatedArray
  //     )
  // {
  //     vaultsAddresses = new address[](_vaults.length());
  //     controllerArray = new address[](_vaults.length());
  //     tokenArray = new address[](_vaults.length());
  //     strategyArray = new address[](_vaults.length());
  //     isWrappedArray = new bool[](_vaults.length());
  //     isDelegatedArray = new bool[](_vaults.length());
  //
  //     for (uint256 i = 0; i < _vaults.length(); i++) {
  //         vaultsAddresses[i] = _vaults.at(i);
  //         (address _controller, address _token, address _strategy, bool _isWrapped, bool _isDelegated) = _getVaultData(_vaults.at(i));
  //         controllerArray[i] = _controller;
  //         tokenArray[i] = _token;
  //         strategyArray[i] = _strategy;
  //         isWrappedArray[i] = _isWrapped;
  //         isDelegatedArray[i] = _isDelegated;
  //     }
  // }
  it('should get vaults info', async () => {

  });

});
