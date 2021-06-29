pragma solidity ^0.6.0;

interface IVoting {
    function stakeFor(address _for, uint256 amount) external;
}
