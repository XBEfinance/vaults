pragma solidity ^0.6.0;

interface IPool {
    function coins(int128 i) external view returns(address);
    function add_liquidity(uint256[] memory _uamounts, uint256 _minMintAmount) external;
    function token() external view returns(address);
}