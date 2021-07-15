pragma solidity ^0.6.0;

import "./base/WithFeesAndRsOnDepositVault.sol";

/// убрать комиссии и реф программу
/// @title SushiVault
/// @notice Vault for staking LP Sushiswap and receive rewards in CVX
contract SushiVault is WithFeesAndRsOnDepositVault {
    constructor() WithFeesAndRsOnDepositVault("XBE Sushi LP", "xs") public {}
}
