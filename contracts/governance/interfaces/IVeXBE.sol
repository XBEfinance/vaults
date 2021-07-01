pragma solidity ^0.4.24;

interface IVeXBE {
    function getLastUserSlope(address addr) external view returns(int128);
    function lockedEnd(address addr) external view returns(uint256);
    function userPointEpoch(address addr) external view returns(uint256);
    function userPointHistoryTs(address addr, uint256 epoch) external view returns(uint256);
    function balanceOfAt(address addr, uint256 _block) external view returns(uint256);
    function balanceOf(address addr) external view returns(uint256);
    function totalSupply() external view returns(uint256);
    function lockStarts(address addr) external view returns(uint256);
}
