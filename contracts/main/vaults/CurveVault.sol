pragma solidity ^0.6.0;

import "./base/BaseVault.sol";

/// @title In this case _token it's lp curve;
/// @notice Vault for consumers of the system
contract CurveVault is BaseVault {
    /// @notice Constructor that creates a consumer vault
    constructor() BaseVault("Curve", "crv") public {}
}
