pragma solidity ^0.6.0;

interface IGaugeLiquidity {
    function deposit(uint256 _amount, address _receiver) external;

    function claimable_tokens(address _addr) external view returns (uint256);
}
