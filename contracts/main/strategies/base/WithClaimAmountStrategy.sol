pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./ClaimableStrategy.sol";
import '../../interfaces/ITreasury.sol';
import '../../interfaces/IRewards.sol';
import "../../interfaces/IVoting.sol";

/// @title ClaimableStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
abstract contract WithClaimAmountStrategy is ClaimableStrategy {

    // reward token => IRewards of convex
    mapping (address => address) public rewardTokensToConvexRewardSources;

    function canClaimAmount(address _rewardToken)
        override
        virtual
        external
        returns(uint256 _amount)
    {
        address rewardSourceContractAddress = rewardTokensToConvexRewardSources[_rewardToken];
        if (rewardSourceContractAddress != address(0)) {
            _amount = _getAmountOfPendingRewardEarnedFrom(rewardSourceContractAddress);
        } else {
            _amount = 0;
        }
    }

    function _getAmountOfPendingRewardEarnedFrom(address rewardSourceContract)
        internal
        virtual
        returns(uint256);
}
