pragma solidity ^0.6.0;

import "./base/WithFeesAndRsOnDepositVault.sol";

/// @title CVXVault
/// @notice Vault for staking of CVX and receive rewards in cvxCRV
contract CVXVault is WithFeesAndRsOnDepositVault {
    constructor() WithFeesAndRsOnDepositVault("XBE CVX", "xc") public {}
}
