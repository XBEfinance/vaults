pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./ClaimableStrategy.sol";
import "../../interfaces/IRewards.sol";

abstract contract WithClaimAmountStrategy is ClaimableStrategy {
    // reward token => IRewards of convex
    mapping(address => address) public rewardTokensToRewardSources;

    function earned(address[] calldata _tokens)
        external
        view
        override
        returns (uint256[] memory _amounts)
    {
        _amounts = new uint256[](_tokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            _amounts[i] = IERC20(_tokens[i]).balanceOf(address(this));
        }
    }

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
        returns (uint256)
    {
        return IRewards(rewardSourceContract).earned(address(this));
    }
}
