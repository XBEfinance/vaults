pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./ClaimableStrategy.sol";

/// @title ClaimableStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
abstract contract WithClaimAmountStrategy is ClaimableStrategy {

    // reward token => IRewards of convex
    mapping (address => address) public rewardTokensToConvexRewardSources;

    function canClaimAmount(address _rewardToken)
        override
        virtual
        view
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
        view
        virtual
        returns(uint256);
}
