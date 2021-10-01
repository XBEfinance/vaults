pragma solidity ^0.6.0;

interface ICrvDepositor {
    function depositAll(bool _lock, address _stakeAddress) external;
}
