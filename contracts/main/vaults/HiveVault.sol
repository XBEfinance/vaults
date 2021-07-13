pragma solidity ^0.6.0;

import "./base/WithFeesAndRsOnDepositVault.sol";

/// @title SushiVault
/// @notice Vault for staking LP Sushiswap and receive rewards in CVX
contract HiveVault is WithFeesAndRsOnDepositVault {
    constructor() WithFeesAndRsOnDepositVault("XBE Hive Curve LP", "xh") public {}
}
