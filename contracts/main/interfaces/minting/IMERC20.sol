pragma solidity ^0.6.0;

interface IMERC20 {
    function mint(address _to, uint256 _value) external returns (bool);
}
