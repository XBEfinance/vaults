pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

import "../governance/Governable.sol";

contract BankProxyAdmin is ProxyAdmin {

    constructor(address _governable) public {
        transferOwnership(Governable(_governable).governance());
    }

}
