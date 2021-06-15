pragma solidity ^0.6.0;

interface ISmartWalletChecker {
    function check(address addr) external view returns(bool);
}
