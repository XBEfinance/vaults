pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/ClaimableStrategy.sol";

/// @title SushiStrategy
contract SushiStrategy is ClaimableStrategy {
  
    struct Settings {
        address xbeToken;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _governance,
        Settings memory _poolSettings
    ) public onlyOwner initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        poolSettings.xbeToken = _xbeToken;
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {}

    function getRewards() external override {}

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        return 0;
    }
}
