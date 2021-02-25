pragma solidity ^0.6.0;

import "./EURxbVault.sol";

/// @title InstitutionalEURxbVault
/// @notice Vault for investors of the system
contract InstitutionalEURxbVault is EURxbVault {
    /// @notice Constructor that creates a vault for investors
    constructor() EURxbVault("Institutional", "i") public {}
}
