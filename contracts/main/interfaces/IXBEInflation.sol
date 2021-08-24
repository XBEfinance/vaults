pragma solidity ^0.6.0;

interface IXBEInflation {
    function futureEpochTimeWrite() external returns (uint256);

    function rate() external view returns (uint256);
}
