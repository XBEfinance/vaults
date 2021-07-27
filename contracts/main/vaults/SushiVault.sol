pragma solidity ^0.6.0;

import "./base/BaseVault.sol";
import "./base/VaultWithAutoStake.sol";
import "./base/VaultWithFeesOnClaim.sol";

/// @title SushiVault
/// @notice Vault for staking LP Sushiswap and receive rewards in CVX
contract SushiVault is BaseVault, VaultWithAutoStake, VaultWithFeesOnClaim {

    constructor() BaseVault("XBE Sushi LP", "xs") public {}

    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address _tokenToAutostake,
        address _votingStakingRewards,
        address[] memory _rewardsTokens,
        string memory __namePostfix,
        string memory __symbolPostfix
    ) public initializer {
        _configureVaultWithAutoStake(_tokenToAutostake, _votingStakingRewards);
        _configureVaultWithFeesOnClaim(false);
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

    function getValidTokensLength() public view returns (uint256) {
        return _validTokens.length();
    }

    /// @notice Transfer tokens to controller, controller transfers it to strategy and earn (farm)
    function earn() external virtual override {
        uint256 _bal = stakingToken.balanceOf(address(this));
        stakingToken.safeTransfer(address(_controller), _bal);
        _controller.earn(address(stakingToken), _bal);
        for (uint256 i = 0; i < _validTokens.length(); i++) {
            _controller.claim(address(stakingToken), _validTokens.at(i));
        }
    }

    function _getReward(
        uint8 _claimMask,
        address _for,
        address _rewardToken,
        address _stakingToken
    )
        internal override
    {
        // _updateReward(_rewardToken, _for);
        uint256 reward = rewards[_for][_rewardToken];
        if (reward > 0) {
            rewards[_for][_rewardToken] = 0;
            reward = _getAndDistributeFeesOnClaimForToken(_for, _rewardToken, reward);
            _autoStakeForOrSendTo(_rewardToken, reward, _for);
        }

        emit RewardPaid(_rewardToken, _for, reward);
    }

    function _isUserAuthorized(address _user) internal override view returns(bool) {
        return owner() == _user;
    }
}
