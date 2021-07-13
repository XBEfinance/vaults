pragma solidity ^0.6.0;

import "./base/WithFeesAndRsOnDepositVault.sol";

/// @title CRVVault
/// @notice Vault for staking cvxCRV and receiving CRV + CVX
contract CvxCrvVault is WithFeesAndRsOnDepositVault {
    constructor() WithFeesAndRsOnDepositVault("XBE cvxCRV", "xr") public {}
}
