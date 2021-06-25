pragma solidity ^0.6.0;

interface IRewards{
    function stake(address, uint256) external;
    function stakeFor(address, uint256) external;
    function withdraw(address, uint256) external;
    function exit(address) external;
    function getReward(address) external;
    function getReward() external returns(bool);
    function queueNewRewards(uint256) external;
    function notifyRewardAmount(uint256) external;
    function addExtraReward(address) external;
    function stakingToken() external returns (address);
    function withdrawAndUnwrap(uint256 amount, bool claim) external returns(bool);
    function earned(address account) external view returns (uint256);
}