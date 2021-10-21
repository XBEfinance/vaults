pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/ClaimableStrategy.sol";
import "../interfaces/IBooster.sol";
import "../interfaces/IRewards.sol";
import "../interfaces/ICVXRewards.sol";
import "../interfaces/curve/ICurveCvxCrvStableSwap.sol";
import "../interfaces/vault/IVaultTransfers.sol";

/// @title CvxCrvStrategy
contract CvxCrvStrategy is ClaimableStrategy {

    uint256 public constant MAX_BPS = 10000;

    struct Settings {
        address crvRewards;
        address cvxRewards;
        address convexBooster;
        address crvDepositor;
        address crvToken;
        uint256 poolIndex;
        address cvxCrvToken;
        address curveCvxCrvStableSwapPool;
        uint256 curveCvxCrvIndexInStableSwapPool;
        uint256 curveAddLiquiditySlippageTolerance; // in bps, ex: 9500 == 5%
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _governance,
        Settings memory _poolSettings
    ) public onlyOwner initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        poolSettings = _poolSettings;
    }

    function setPoolIndex(uint256 _newPoolIndex) external onlyOwner {
        poolSettings.poolIndex = _newPoolIndex;
    }

    function checkPoolIndex(uint256 index) public view returns (bool) {
        IBooster.PoolInfo memory _pool = IBooster(poolSettings.convexBooster)
            .poolInfo(index);
        return _pool.lptoken == _want;
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        if (checkPoolIndex(poolSettings.poolIndex)) {
            IERC20 wantToken = IERC20(_want);
            if (
                wantToken.allowance(
                    address(this),
                    poolSettings.convexBooster
                ) == 0
            ) {
                wantToken.approve(poolSettings.convexBooster, uint256(-1));
            }
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

        ICVXRewards(poolSettings.cvxRewards).getReward(true);
    }

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        IRewards(poolSettings.crvRewards).withdraw(_amount, true);

        require(
            IBooster(poolSettings.convexBooster).withdraw(
                poolSettings.poolIndex,
                _amount
            ),
            "!withdrawSome"
        );

        return _amount;
    }

    function _convertTokens(uint256 _amount) internal{
        IERC20 convertToken = IERC20(poolSettings.crvToken);
        convertToken.safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        if (
            convertToken.allowance(address(this), poolSettings.crvDepositor) == 0
        ) {
            convertToken.approve(poolSettings.crvDepositor, uint256(-1));
        }
        //address(0) means that we'll not stake immediately
        //for provided sender (cause it's zero addr)
        IRewards(poolSettings.crvDepositor).depositAll(true, address(0));
    }

    function convertTokens(uint256 _amount) external {
        _convertTokens(_amount);
        IERC20 _stakingToken = IERC20(_want);
        uint256 cvxCrvAmount = _stakingToken.balanceOf(address(this));
        _stakingToken.safeTransfer(msg.sender, cvxCrvAmount);
    }

    function convertAndStakeTokens(uint256 _amount) external {
        _convertTokens(_amount);

        uint256 cvxCrvBalance = IERC20(poolSettings.cvxCrvToken).balanceOf(address(this));
        uint256[2] memory _amounts;
        _amounts[poolSettings.curveCvxCrvIndexInStableSwapPool] = cvxCrvBalance;

        ICurveCvxCrvStableSwap stableSwapPool = ICurveCvxCrvStableSwap(
          poolSettings.curveCvxCrvStableSwapPool
        );

        uint256 curveCvxCrvLPAmount = stableSwapPool.calc_token_amount(_amounts, true);

        uint256 minCurveCvxCrvLPAmount = curveCvxCrvLPAmount
          .mul(poolSettings.curveAddLiquiditySlippageTolerance)
          .div(MAX_BPS);

        uint256 actualCurveCvxCrvLPAmount = stableSwapPool.add_liquidity(
            _amounts,
            minCurveCvxCrvLPAmount,
            address(this)
        );

        IERC20 _stakingToken = IERC20(_want);
        address vault = IController(controller).vaults(_want);
        _stakingToken.approve(vault, actualCurveCvxCrvLPAmount);
        IVaultTransfers(vault).depositFor(actualCurveCvxCrvLPAmount, msg.sender);
    }
}
