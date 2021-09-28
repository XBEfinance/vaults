pragma solidity ^0.6.0;

contract FakeWalletChecker {
    function check(address addr) external returns (bool) {
        return true;
    }
}
