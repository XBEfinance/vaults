pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/IController.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/vault/IVaultCore.sol";
import "./interfaces/vault/IVaultDelegated.sol";
import "./interfaces/vault/IVaultWrapped.sol";
import "./governance/Governable.sol";
import "./templates/Initializable.sol";

contract Registry is Governable, Initializable {

    using Address for address;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;


    EnumerableSet.AddressSet private _vaults;
    EnumerableSet.AddressSet private _controllers;

    mapping(address => address) public wrappedVaults;
    mapping(address => bool) public isDelegatedVault;

    function getName() external pure returns(string memory) {
      return "Registry";
    }

    function addVault(address _vault) public onlyGovernance {
        _addVault(_vault);
        (address controller, , , , ) = _getVaultData(_vault);
        _addController(controller);
    }

    function addWrappedVault(address _vault) public onlyGovernance {
        addVault(_vault);
        address _wrappedVault = IVaultWrapped(_vault).vault();

        require(_wrappedVault.isContract(), "!contractWrapped");
        wrappedVaults[_vault] = _wrappedVault;

        // (address controller, , , , ) = _getVaultData(_vault);

        // Adds to controllers array
        // _addController(controller);
        // TODO Add and track tokens and strategies? [historical]
        // (current ones can be obtained via getVaults + getVaultInfo)
    }

    function addDelegatedVault(address _vault) public onlyGovernance {
        addVault(_vault);
        isDelegatedVault[_vault] = true;
        // (address controller, , , , ) = _getVaultData(_vault);
        // Adds to controllers array
        // _addController(controller);
        // TODO Add and track tokens and strategies? [historical]
        // (current ones can be obtained via getVaults + getVaultInfo)
    }

    function _addVault(address _vault) internal {
        require(_vault.isContract(), "!contract");
        // Checks if vault is already on the array
        require(!_vaults.contains(_vault), "exists");
        // Adds unique _vault to _vaults array
        _vaults.add(_vault);
    }

    function _addController(address _controller) internal {
        // Adds Controller to controllers array
        if (!_controllers.contains(_controller)) {
            _controllers.add(_controller);
        }
    }

    function removeVault(address _vault) public onlyGovernance {
        _vaults.remove(_vault);
    }

    function _getVaultData(address _vault)
        internal
        view
        returns (
            address controller,
            address token,
            address strategy,
            bool isWrapped,
            bool isDelegated
        )
    {
        address vault = _vault;
        isWrapped = wrappedVaults[_vault] != address(0);
        if (isWrapped) {
            vault = wrappedVaults[_vault];
        }
        isDelegated = isDelegatedVault[vault];

        // Get values from controller
        controller = IVaultCore(vault).controller();
        if (isWrapped && IVaultDelegated(vault).underlying() != address(0)) {
            token = IVaultCore(_vault).token(); // Use non-wrapped vault
        } else {
            token = IVaultCore(vault).token();
        }

        if (isDelegated) {
            strategy = IController(controller).strategies(vault);
        } else {
            strategy = IController(controller).strategies(token);
        }

        // Check if vault is set on controller for token
        address controllerVault = address(0);
        if (isDelegated) {
            controllerVault = IController(controller).vaults(strategy);
        } else {
            controllerVault = IController(controller).vaults(token);
        }
        require(controllerVault == vault, "!controllerVaultMatch"); // Might happen on Proxy Vaults

        // Check if strategy has the same token as vault
        if (isWrapped) {
            address underlying = IVaultDelegated(vault).underlying();
            require(underlying == token, "!wrappedTokenMatch"); // Might happen?
        } else if (!isDelegated) {
            address strategyToken = IStrategy(strategy).want();
            require(token == strategyToken, "!strategyTokenMatch"); // Might happen?
        }

        return (controller, token, strategy, isWrapped, isDelegated);
    }

    // Vaults getters
    function getVault(uint256 index) external view returns(address vault) {
        return _vaults.at(index);
    }

    function getVaultsLength() external view returns(uint256) {
        return _vaults.length();
    }

    function getVaults() external view returns(address[] memory) {
        address[] memory vaultsArray = new address[](_vaults.length());
        for (uint256 i = 0; i < _vaults.length(); i++) {
            vaultsArray[i] = _vaults.at(i);
        }
        return vaultsArray;
    }

    function getVaultInfo(address _vault)
        external
        view
        returns (
            address controller,
            address token,
            address strategy,
            bool isWrapped,
            bool isDelegated
        )
    {
        (controller, token, strategy, isWrapped, isDelegated) = _getVaultData(_vault);
        return (controller, token, strategy, isWrapped, isDelegated);
    }

    function getVaultsInfo()
        external
        view
        returns (
            address[] memory vaultsAddresses,
            address[] memory controllerArray,
            address[] memory tokenArray,
            address[] memory strategyArray,
            bool[] memory isWrappedArray,
            bool[] memory isDelegatedArray
        )
    {
        vaultsAddresses = new address[](_vaults.length());
        controllerArray = new address[](_vaults.length());
        tokenArray = new address[](_vaults.length());
        strategyArray = new address[](_vaults.length());
        isWrappedArray = new bool[](_vaults.length());
        isDelegatedArray = new bool[](_vaults.length());

        for (uint256 i = 0; i < _vaults.length(); i++) {
            vaultsAddresses[i] = _vaults.at(i);
            (address _controller, address _token, address _strategy, bool _isWrapped, bool _isDelegated) = _getVaultData(_vaults.at(i));
            controllerArray[i] = _controller;
            tokenArray[i] = _token;
            strategyArray[i] = _strategy;
            isWrappedArray[i] = _isWrapped;
            isDelegatedArray[i] = _isDelegated;
        }
    }
}
