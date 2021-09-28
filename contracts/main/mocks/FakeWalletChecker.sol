pragma solidity >=0.7.0 <0.9.0;

contract FakeWalletChecker {
    function check(address addr) external returns (bool) {
        return true;
    }
}
