pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import "../interfaces/IConvexMasterChef.sol";

/// @title SushiStrategy
contract SushiStrategy is WithClaimAmountStrategy {
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
        _configure(
            _wantAddress,
            _controllerAddress,
            _governance
        );
        poolSettings = _poolSettings;
        rewardTokensToRewardSources[_poolSettings.xbeToken] = _poolSettings
            .xbeToken;
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        uint256 _amount = IERC20(_want).balanceOf(address(this));
    }

    function getRewards() external override {}

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        IERC20(poolSettings.lpSushi).safeTransfer(msg.sender, _amount);
        return _amount;
    }

    function _getAmountOfPendingRewardEarnedFrom(
        address _rewardSourceContractAddress
    ) internal view override returns (uint256) {
        return IERC20(_rewardSourceContractAddress).balanceOf(address(this));
    }

    function convertTokens(uint256 _amount) external override {}

    function convertAndStakeTokens(uint256 _amount) external override {}
}
