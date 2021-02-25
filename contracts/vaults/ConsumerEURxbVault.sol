pragma solidity ^0.6.0;

import "./EURxbVault.sol";

/// @title ConsumerEURxbVault
/// @notice Vault for consumers of the system
contract ConsumerEURxbVault is EURxbVault {
    /// @notice Constructor that creates a consumer vault
    constructor() EURxbVault("Consumer", "c") public {}
}
