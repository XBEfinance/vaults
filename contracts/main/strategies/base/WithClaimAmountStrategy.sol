pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./ClaimableStrategy.sol";

abstract contract WithClaimAmountStrategy is ClaimableStrategy {
    // reward token => IRewards of convex
    mapping(address => address) public rewardTokensToRewardSources;

    function canClaimAmount(address _rewardToken)
        external
        view
        virtual
        override
        returns (uint256 _amount)
    {
        address rewardSourceContractAddress = rewardTokensToRewardSources[
            _rewardToken
        ];
        if (rewardSourceContractAddress != address(0)) {
            _amount = _getAmountOfPendingRewardEarnedFrom(
                rewardSourceContractAddress
            );
        } else {
            _amount = 0;
        }
    }

    function _getAmountOfPendingRewardEarnedFrom(address rewardSourceContract)
        internal
        view
        virtual
        returns (uint256);
}
