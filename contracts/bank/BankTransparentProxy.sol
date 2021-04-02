pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol"


/// @title Bank
/// @notice EURxb Token Exchange Contract
contract BankTransparentProxy is TransparentUpgradeableProxy {

    constructor(address _bank, address _bankAdminContract)
        external
        payable
        TransparentUpgradeableProxy(_bank, _bankAdminContract, bytes32(0))
    {}

}
