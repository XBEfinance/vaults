pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import "../interfaces/IRewards.sol";
import "../interfaces/vault/IVaultTransfers.sol";

/// @title CvxCrvStrategy
contract CvxCrvStrategy is WithClaimAmountStrategy {
    struct Settings {
        address lpCurve;
        address cvxCRVRewards;
        address crvDepositor;
        address convexBooster;
        address cvxCrvToken;
        address crvToken;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _governance,
        address _voting,
        Settings memory _poolSettings
    ) public initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        poolSettings = _poolSettings;
        rewardTokensToRewardSources[_poolSettings.cvxCrvToken] = _poolSettings
            .cvxCRVRewards;
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        uint256 _amount = IERC20(_want).balanceOf(address(this));
        IERC20(_want).approve(poolSettings.crvDepositor, _amount);
        IRewards(poolSettings.crvDepositor).depositAll(
            true,
            poolSettings.cvxCRVRewards
        );
    }

    function _getAmountOfPendingRewardEarnedFrom(
        address _rewardSourceContractAddress
    ) internal view override returns (uint256) {
        return IRewards(_rewardSourceContractAddress).earned(address(this));
    }

    function getRewards() external override {
        require(
            IRewards(poolSettings.cvxCRVRewards).getReward(),
            "!getRewards"
        );
    }

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        require(
            IRewards(poolSettings.cvxCRVRewards).withdrawAndUnwrap(
                _amount,
                true
            ),
            "!withdrawSome"
        );
        return _amount;
    }

    function _convertTokens(uint256 _amount) internal returns (address) {
        IERC20(poolSettings.crvToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        IERC20(_want).approve(poolSettings.crvDepositor, _amount);
        address _stakingToken = IRewards(poolSettings.cvxCRVRewards)
            .stakingToken();
        //address(0) means that we'll not stake immediately
        //for provided sender (cause it's zero addr)
        IRewards(poolSettings.crvDepositor).depositAll(true, address(0));
        return _stakingToken;
    }

    function convertTokens(uint256 _amount) external {
        address _stakingToken = _convertTokens(_amount);
        IERC20(_stakingToken).safeTransfer(msg.sender, _amount);
    }

    function convertAndStakeTokens(uint256 _amount) external {
        address _stakingToken = _convertTokens(_amount);
        address vault = IController(controller).vaults(_want);
        IERC20(_stakingToken).approve(vault, _amount);
        IVaultTransfers(vault).deposit(_amount);
    }
}
