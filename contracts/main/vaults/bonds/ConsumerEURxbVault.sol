pragma solidity ^0.6.0;

import "../base/BaseVault.sol";

/// @title ConsumerEURxbVault
/// @notice Vault for consumers of the system
contract ConsumerEURxbVault is BaseVault {
    /// @notice Constructor that creates a consumer vault
    constructor() public BaseVault("Consumer", "co") {}

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _initialToken Business token logic address
    /// @param _initialController Controller instance address
    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address[] calldata _rewardTokens,
        string calldata _namePostfix,
        string calldata _symbolPostfix
    ) external initializer {
        _configure(
            _initialToken,
            _initialController,
            _governance,
            _rewardsDuration,
            _rewardTokens,
            _namePostfix,
            _symbolPostfix
        );
    }
}
