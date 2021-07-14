pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import '../interfaces/IRewards.sol';

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
        address _vaultAddress,
        address _governance,
        address _voting,
        Settings memory _poolSettings
    ) public initializer {
        _configure(
            _wantAddress,
            _controllerAddress,
            _vaultAddress,
            _governance,
            address(0),
            _voting
        );
        poolSettings = _poolSettings;
        rewardTokensToConvexRewardSources[_poolSettings.cvxToken] = _poolSettings.cvxRewards;
    }

    function setPoolIndex(uint256 _newPoolIndex) external onlyOwner {
        poolSettings.poolIndex = _newPoolIndex;
    }

     /// @dev Function that controller calls
    function deposit() override external onlyController {
        uint256 _amount = IERC20(_want).balanceOf(address(this));
        _totalDeposited += _amount;

        IERC20(_want).approve(poolSettings.cvxRewards, _amount);
        IRewards(poolSettings.cvxRewards).stake(_amount);
    }

    function getRewards() override external {
        require(IRewards(poolSettings.cvxRewards).getReward(), '!getRewards');
    }

    function _withdrawSome(uint256 _amount) override internal returns(uint) {
        require(IRewards(poolSettings.cvxRewards).withdrawAndUnwrap(_amount, true),
            '!withdrawSome');
        return _amount;
    }

    function _getAmountOfPendingRewardEarnedFrom(address _rewardSourceContractAddress)
        override
        internal
        returns(uint256)
    {
        return IRewards(_rewardSourceContractAddress).earned(address(this));
    }

    function convertTokens(uint256 _amount) override external {}
}
