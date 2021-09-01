pragma solidity ^0.6.0;

import "./base/BaseVault.sol";
import "./base/VaultWithAutoStake.sol";
import "./base/VaultWithFeesOnClaim.sol";
import "./base/VaultWithFeesOnDeposit.sol";
import "./base/VaultWithReferralProgram.sol";

/// @title CVXVault
/// @notice Vault for staking of CVX and receive rewards in cvxCRV
contract CVXVault is
    BaseVault,
    VaultWithAutoStake,
    VaultWithFeesOnClaim,
    VaultWithFeesOnDeposit,
    VaultWithReferralProgram
{
    constructor() public BaseVault("XBE CVX", "xc") {}

    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address _tokenToAutostake,
        address _votingStakingRewards,
        bool _enableFees,
        address _teamWallet,
        address _referralProgram,
        address _treasury,
        address[] memory _rewardsTokens,
        string memory __namePostfix,
        string memory __symbolPostfix
    ) public onlyOwner initializer {
        _configureVaultWithAutoStake(_tokenToAutostake, _votingStakingRewards);
        _configureVaultWithFeesOnClaim(_enableFees);
        _configureVaultWithFeesOnDeposit(_teamWallet);
        _configureVaultWithReferralProgram(_referralProgram, _treasury);
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

    function _deposit(address _from, uint256 _amount)
        internal
        override
        returns (uint256)
    {
        require(_amount > 0, "Cannot stake 0");
        _amount = _getFeeForDepositAndSendIt(stakingToken, _amount);
        _totalSupply = _totalSupply.add(_amount);
        _balances[_from] = _balances[_from].add(_amount);
        stakingToken.safeTransferFrom(_from, address(this), _amount);
        emit Staked(_from, _amount);
        _registerUserInReferralProgramIfNeeded(_from);
        return _amount;
    }

    function _getReward(
        bool _claimUnderlying,
        address _for,
        address _rewardToken,
        address _stakingToken
    ) internal override {
        if (_claimUnderlying) {
            _controller.getRewardStrategy(_stakingToken);
        }
        _controller.claim(_stakingToken, _rewardToken);
        uint256 reward = rewards[_for][_rewardToken];
        if (reward > 0) {
            rewards[_for][_rewardToken] = 0;
            reward = _getAndDistributeFeesOnClaimForToken(_for, _rewardToken, reward);
            _autoStakeForOrSendTo(_rewardToken, reward, _for);
        }
        emit RewardPaid(_rewardToken, _for, reward);
    }

    function _isUserAuthorized(address _user)
        internal
        view
        override
        returns (bool)
    {
        return owner() == _user;
    }
}
