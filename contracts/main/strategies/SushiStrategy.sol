pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import '../interfaces/IConvexMasterChef.sol';

/// @title SushiStrategy
/// @notice This is contract
contract SushiStrategy is WithClaimAmountStrategy {

    struct Settings {
        address lpSushi;
        address convexMasterChef;
        uint256 poolIndex;
        address cvxToken;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _vaultAddress,
        address _governance,
        address _tokenToAutostake,
        address _voting,
        Settings memory _poolSettings
    ) public initializer {
        _configure(
            _wantAddress,
            _controllerAddress,
            _vaultAddress,
            _governance,
            _tokenToAutostake,
            _voting,
            false
        );
        poolSettings = _poolSettings;
        rewardTokensToConvexRewardSources[_poolSettings.cvxToken] = _poolSettings.convexMasterChef;
    }

    function setPoolIndex(uint256 _newPoolIndex) external onlyOwner {
        poolSettings.poolIndex = _newPoolIndex;
    }

    function getPoolsCount() public view returns(uint256) {
        return IConvexMasterChef(poolSettings.convexMasterChef).poolLength();
    }

    function checkPoolIndex(uint256 index) public view returns(bool) {
        IConvexMasterChef.PoolInfo memory _pool = IConvexMasterChef(
            poolSettings.convexMasterChef
        ).poolInfo(index);
        return _pool.lpToken == poolSettings.lpSushi;
    }

    function checkIfPoolIndexNeedsToBeUpdated() public view returns(bool) {
        return checkPoolIndex(poolSettings.poolIndex);
    }

    /// @dev Function that controller calls
    function deposit() override external onlyController {
        if (!checkIfPoolIndexNeedsToBeUpdated()) {
            uint256 _amount = IERC20(_want).balanceOf(address(this));
            _totalDeposited += _amount;
            IERC20(_want).approve(poolSettings.convexMasterChef, _amount);
            //true means that the received lp tokens will immediately be stakes
            IConvexMasterChef(poolSettings.convexMasterChef)
                .deposit(poolSettings.poolIndex, _amount);
        }
    }

    function getRewards() override external {
        IConvexMasterChef(poolSettings.convexMasterChef).claim(
            poolSettings.poolIndex,
            address(this)
        );
    }

    function _withdrawSome(uint256 _amount) override internal returns(uint256) {
        uint256 _before = IERC20(poolSettings.lpSushi).balanceOf(address(this));
        IConvexMasterChef(poolSettings.convexMasterChef)
            .withdraw(poolSettings.poolIndex, _amount);
        uint256 _after = IERC20(poolSettings.lpSushi).balanceOf(address(this));
        return _after.sub(_before);
    }

    function _getAmountOfPendingRewardEarnedFrom(address _rewardSourceContractAddress)
        override
        view
        internal
        returns(uint256)
    {
        return IConvexMasterChef(_rewardSourceContractAddress)
            .pendingCvx(poolSettings.poolIndex, address(this));
    }

    function convertTokens(uint256 _amount) override external {}
}
