pragma solidity ^0.6.0;

interface IBonusCampaign {
    function rewardsDuration() external view returns(uint256);
    function periodFinish() external view returns(uint256);
    function canRegister(address user) external view returns(bool);
    function registerFor(address user) external;
}
