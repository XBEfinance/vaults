pragma solidity ^0.4.24;

interface IVoting {
    function lock() external view returns(uint256);
    function voteLock(address _addr) external view returns(uint256);
}
