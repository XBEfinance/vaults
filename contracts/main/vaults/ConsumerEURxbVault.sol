pragma solidity ^0.6.0;

import "./BaseVault.sol";

/// @title ConsumerEURxbVault
/// @notice Vault for consumers of the system
contract ConsumerEURxbVault is BaseVault {
    /// @notice Constructor that creates a consumer vault
    constructor() BaseVault("Consumer", "co") public {}
}
