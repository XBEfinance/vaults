pragma solidity ^0.6.0;

import "./base/BaseVault.sol";

/// @title SushiVault
/// @notice Vault for staking LP Sushiswap and receive rewards in CVX
contract SushiVault is BaseVault {
    constructor() BaseVault("XBE Sushi LP", "xs") public {}

    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address[] memory _rewardTokens,
        string memory __namePostfix,
        string memory __symbolPostfix
    ) public initializer virtual {
        _configure(
            _initialToken,
            _initialController,
            _governance,
            _rewardsDuration,
            _rewardTokens,
            __namePostfix,
            __symbolPostfix
        );
    }
}
