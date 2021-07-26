pragma solidity ^0.6.0;

import "./base/BaseVault.sol";
import "./base/VaultWithAutoStake.sol";

/// @title SushiVault
/// @notice Vault for staking LP Sushiswap and receive rewards in CVX
contract SushiVault is BaseVault, VaultWithAutoStake {

    constructor() BaseVault("XBE Sushi LP", "xs") public {}

    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address _tokenToAutostake,
        address _votingStakingRewards,
        bool _enableFees,
        address[] memory _rewardsTokens,
        string memory __namePostfix,
        string memory __symbolPostfix
    ) public initializer {
        _configureVaultWithAutoStake(_tokenToAutostake, _votingStakingRewards);
        _configureVaultWithFeesOnClaim(_enableFees);
        _configure(
            _initialToken,
            _initialController,
            _governance,
            _rewardsDuration,
            _rewardsTokens,
            __namePostfix,
            __symbolPostfix
        );
    }

    function _getReward(
        uint8 _claimMask,
        address _for,
        address _rewardToken,
        address _stakingToken
    )
        internal override
    {
        uint256 reward = rewards[_for][_rewardToken];
        _controller.claim(_stakingToken, _rewardToken);
        if (reward > 0) {
            if (reward > 0) {
                rewards[_for][_rewardToken] = 0;
                _autoStakeForOrSendTo(_rewardToken, reward, _for);
                emit RewardPaid(_rewardToken, _for, reward);
            } else {
                emit RewardPaid(_rewardToken, _for, 0);
            }
        }
    }

    function _isUserAuthorized(address _user) internal override view returns(bool) {
        return owner() == _user;
    }
}
