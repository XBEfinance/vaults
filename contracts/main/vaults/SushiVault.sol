pragma solidity ^0.6.0;

import "./base/BaseVault.sol";

/// @title SushiVault
/// @notice Vault for staking LP Sushiswap and receive rewards in CVX
contract SushiVault is BaseVault {
    constructor() BaseVault("XBE Sushi LP", "xs") public {}
}
