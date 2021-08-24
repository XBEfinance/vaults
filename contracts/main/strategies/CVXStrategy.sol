pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import "../interfaces/IRewards.sol";

/// @title CVXStrategy
/// @notice CVXVault strategy: in CVX out cvxCRV
contract CVXStrategy is WithClaimAmountStrategy {
    struct Settings {
        address cvxRewards;
        address cvxToken;
        uint256 poolIndex;
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
        rewardTokensToRewardSources[_poolSettings.cvxToken] = _poolSettings
            .cvxRewards;
    }

    function setPoolIndex(uint256 _newPoolIndex) external onlyOwner {
        poolSettings.poolIndex = _newPoolIndex;
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        uint256 _amount = IERC20(_want).balanceOf(address(this));

        IERC20(_want).approve(poolSettings.cvxRewards, _amount);
        IRewards(poolSettings.cvxRewards).stake(_amount);
    }

    function getRewards() external override {
        require(IRewards(poolSettings.cvxRewards).getReward(), "!getRewards");
    }

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        require(
            IRewards(poolSettings.cvxRewards).withdrawAndUnwrap(_amount, true),
            "!withdrawSome"
        );
        return _amount;
    }

    function _getAmountOfPendingRewardEarnedFrom(
        address _rewardSourceContractAddress
    ) internal view override returns (uint256) {
        return IRewards(_rewardSourceContractAddress).earned(address(this));
    }

    function convertTokens(uint256 _amount) external override {}

    function convertAndStakeTokens(uint256 _amount) external override {}
}
