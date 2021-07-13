pragma solidity ^0.6.0;

interface IRewardDistributionRecipient {
    function notifyRewardAmount(uint256 reward) external;
    function setStrategyWhoCanAutoStake(address addr, bool flag) external;
}
