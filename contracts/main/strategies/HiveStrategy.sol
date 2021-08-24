pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import "../interfaces/IBooster.sol";
import "../interfaces/IRewards.sol";

/// @title HiveStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
contract HiveStrategy is WithClaimAmountStrategy {
    struct Settings {
        address lpCurve;
        address crvRewards;
        address cvxRewards;
        address convexBooster;
        uint256 poolIndex;
        address crvToken;
        address cvxToken;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _vaultAddress,
        address _governance,
        Settings memory _poolSettings
    ) public initializer {
        _configure(
            _wantAddress,
            _controllerAddress,
            _vaultAddress,
            _governance
        );
        poolSettings = _poolSettings;
        rewardTokensToRewardSources[_poolSettings.crvToken] = _poolSettings
            .crvRewards;
        rewardTokensToRewardSources[_poolSettings.cvxToken] = _poolSettings
            .cvxRewards;
    }

    function setPoolIndex(uint256 _newPoolIndex) external onlyOwner {
        poolSettings.poolIndex = _newPoolIndex;
    }

    function checkPoolIndex(uint256 index) public view returns (bool) {
        IBooster.PoolInfo memory _pool = IBooster(poolSettings.convexBooster)
            .poolInfo(index);
        return _pool.lptoken == poolSettings.lpCurve;
    }

    function getPoolsCount() public view returns (uint256) {
        return IBooster(poolSettings.convexBooster).poolLength();
    }

    function checkIfPoolIndexNeedsToBeUpdated() public view returns (bool) {
        return !checkPoolIndex(poolSettings.poolIndex);
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        if (!checkIfPoolIndexNeedsToBeUpdated()) {
            uint256 _amount = IERC20(_want).balanceOf(address(this));
            IERC20(_want).approve(poolSettings.convexBooster, _amount);
            //true means that the received lp tokens will immediately be stakes
            IBooster(poolSettings.convexBooster).depositAll(
                poolSettings.poolIndex,
                true
            );
        }
    }

    function getRewards() external override {
        require(
            IRewards(poolSettings.crvRewards).getReward(),
            "!getRewardsCRV"
        );
        require(
            IRewards(poolSettings.cvxRewards).getReward(),
            "!getRewardsCVX"
        );
    }

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        require(
            IBooster(poolSettings.convexBooster).withdraw(
                poolSettings.poolIndex,
                _amount
            ),
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
