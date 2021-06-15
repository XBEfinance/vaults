pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

contract BankProxyAdmin is ProxyAdmin {

    constructor(address _governance) public {
        transferOwnership(_governance);
    }

}
