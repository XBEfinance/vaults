pragma solidity ^0.6.0;

import "./base/BaseVault.sol";
import "./base/VaultWithAutoStake.sol";
import "./base/VaultWithFees.sol";
import "./base/VaultWithReferralProgram.sol";

contract Vault is
    BaseVault,
    VaultWithAutoStake,
    VaultWithFees,
    VaultWithReferralProgram
{
    constructor(string memory _name, string memory _symbol)
        public
        BaseVault(_name, _symbol)
    {}

    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address _tokenToAutostake,
        address _votingStakingRewards,
        bool _enableFees,
        address _depositFeeWallet,
        address _referralProgram,
        address _treasury,
        address[] memory _rewardsTokens,
        string memory _namePostfix,
        string memory _symbolPostfix
    ) public onlyOwner initializer {
        _configureVaultWithAutoStake(_tokenToAutostake, _votingStakingRewards);
        _configureVaultWithFees(_depositFeeWallet, _enableFees);
        _configureVaultWithReferralProgram(_referralProgram, _treasury);
        _configure(
            _initialToken,
            _initialController,
            _governance,
            _rewardsDuration,
            _rewardsTokens,
            _namePostfix,
            _symbolPostfix
        );
    }

    function _deposit(address _from, uint256 _amount)
        internal
        override
        returns (uint256)
    {
        require(_amount > 0, "Cannot stake 0");
        _amount = _getFeesOnDeposit(stakingToken, _amount);
        stakingToken.safeTransferFrom(_from, address(this), _amount);
        _totalSupply = _totalSupply.add(_amount);
        _balances[_from] = _balances[_from].add(_amount);
        _registerUserInReferralProgramIfNeeded(_from);
        emit Staked(_from, _amount);
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
            reward = _getFeesOnClaimForToken(_for, _rewardToken, reward);
            _autoStakeForOrSendTo(_rewardToken, reward, _for);
        }
        emit RewardPaid(_rewardToken, _for, reward);
    }
}
