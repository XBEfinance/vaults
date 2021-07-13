pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/WithClaimAmountStrategy.sol";
import '../interfaces/IRewards.sol';

/// @title CvxCrvStrategy
/// @notice In cvxCRV out CRV TODO: выяснить оборачиваются ли CRV автоматически в cvxCRV
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
            _voting
        );
        poolSettings = _poolSettings;
        rewardTokensToConvexRewards[_poolSettings.cvxCrvToken] = _poolSettings.cvxCRVRewards;
    }

    /// @dev Function that controller calls
    function deposit() override external onlyController {
       uint256 _amount = IERC20(_want).balanceOf(address(this));
       _totalDeposited += _amount;
       IERC20(_want).approve(poolSettings.crvDepositor, _amount);
       IRewards(poolSettings.crvDepositor).depositAll(true, poolSettings.cvxCRVRewards);
    }

    function _getAmountOfPendingRewardEarnedFrom(address _rewardSourceContractAddress)
        override
        internal
        returns(uint256)
    {
        return IRewards(_rewardSourceContractAddress).earned(address(this));
    }

    function getRewards() override external {
        require(IRewards(poolSettings.cvxCRVRewards).getReward(), '!getRewards');
    }

    function _withdrawSome(uint256 _amount) override internal returns(uint) {
        require(IRewards(poolSettings.cvxCRVRewards).withdrawAndUnwrap(_amount, true),
            '!withdrawSome');
        return _amount;
    }

    function convertTokens(uint256 _amount) override external {
        IERC20(poolSettings.crvToken).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_want).approve(poolSettings.crvDepositor, _amount);
        address _stakingToken = IRewards(poolSettings.cvxCRVRewards).stakingToken();
        //address(0) means that we'll not stake immediately
        //for provided sender (cause it's zero addr)
        IRewards(poolSettings.crvDepositor).depositAll(true, address(0));
        IERC20(_stakingToken).safeTransfer(msg.sender, _amount);
    }

}
