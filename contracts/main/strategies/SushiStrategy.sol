pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import "../interfaces/IConvexMasterChef.sol";

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
        Settings memory _poolSettings
    ) public initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        poolSettings = _poolSettings;
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        uint256 _amount = IERC20(_want).balanceOf(address(this));
    }

    function getRewards() external override {}

    function earned(address[] calldata _tokens)
        external
        view
        override
        returns (uint256[] memory _amounts)
    {
        _amounts = new uint256[](_tokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            _amounts[i] = IERC20(_tokens[i]).balanceOf(address(this));
        }
    }

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        IERC20(poolSettings.lpSushi).safeTransfer(msg.sender, _amount);
        return _amount;
    }

    function canClaimAmount(address _rewardToken)
        external
        view
        override
        returns (uint256 _amount)
    {
        if (_rewardToken == poolSettings.xbeToken) {
            _amount = IERC20(poolSettings.xbeToken).balanceOf(address(this));
        } else {
            _amount = 0;
        }
    }
}
