pragma solidity ^0.6.0;

interface IVotingStakingRewards {
    function getReward() external;
    function withdrawBondedOrWithPenalty() external;
}
