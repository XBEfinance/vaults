pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

import "../governance/Governable.sol";

contract BankProxyAdmin is ProxyAdmin, Governable {

    constructor(address _governable) external {
        transferOwnership(Governable(_governable).governance);
    }

}
