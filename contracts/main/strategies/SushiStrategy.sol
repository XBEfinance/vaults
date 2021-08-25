pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/ClaimableStrategy.sol";

/// @title SushiStrategy
contract SushiStrategy is ClaimableStrategy {
    struct Settings {
        address lpSushi;
        address xbeToken;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _governance,
        address _lpSushi,
        address _xbeToken
    ) public initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        poolSettings.lpSushi = _lpSushi;
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
        IERC20(poolSettings.lpSushi).safeTransfer(msg.sender, _amount);
        return _amount;
    }
}
