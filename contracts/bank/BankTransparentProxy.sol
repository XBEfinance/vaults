pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";


contract BankTransparentProxy is TransparentUpgradeableProxy {

    constructor(address _bank, address _bankAdminContract)
        public
        payable
        TransparentUpgradeableProxy(_bank, _bankAdminContract, "")
    {}

}
