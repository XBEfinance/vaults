pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/ClaimableStrategy.sol";
import "../interfaces/IRewards.sol";
import "../interfaces/vault/IVaultTransfers.sol";
import "../interfaces/IStaker.sol";

/// @title CvxCrvStrategy
contract CvxCrvStrategy is ClaimableStrategy {
    struct Settings {
        address cvxCRVRewards;
        address crvDepositor;
        address crvToken;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _governance,
        address _cvxCRVRewards,
        address _crvDepositor,
        address _crvToken
    ) public onlyOwner initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        poolSettings.cvxCRVRewards = _cvxCRVRewards;
        poolSettings.crvDepositor = _crvDepositor;
        poolSettings.crvToken = _crvToken;
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        IERC20 wantToken = IERC20(_want);
        uint256 _amount = wantToken.balanceOf(address(this));
        if (
            wantToken.allowance(address(this), poolSettings.cvxCRVRewards) == 0
        ) {
            wantToken.approve(poolSettings.cvxCRVRewards, uint256(-1));
        }

        IStaker(poolSettings.cvxCRVRewards).stakeAll();
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
            IRewards(poolSettings.cvxCRVRewards).withdraw(
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
        IERC20 convertToken = IERC20(poolSettings.crvToken);
        if (
            convertToken.allowance(address(this), poolSettings.crvDepositor) == 0
        ) {
            convertToken.approve(poolSettings.crvDepositor, uint256(-1));
        }
        address _stakingToken = IRewards(poolSettings.cvxCRVRewards)
            .stakingToken();
        //address(0) means that we'll not stake immediately
        //for provided sender (cause it's zero addr)
        IRewards(poolSettings.crvDepositor).depositAll(true, address(0));
        return _stakingToken;
    }

    function convertTokens(uint256 _amount) external {
        IERC20 _stakingToken = IERC20(_convertTokens(_amount));
        uint256 cvxCrvAmount = _stakingToken.balanceOf(address(this));
        _stakingToken.safeTransfer(msg.sender, cvxCrvAmount);
    }

    function convertAndStakeTokens(uint256 _amount) external {
        IERC20 _stakingToken = IERC20(_convertTokens(_amount));
        address vault = IController(controller).vaults(_want);
        uint256 cvxCrvAmount = _stakingToken.balanceOf(address(this));
        _stakingToken.approve(vault, cvxCrvAmount);
        IVaultTransfers(vault).depositFor(cvxCrvAmount, msg.sender);
    }
}
