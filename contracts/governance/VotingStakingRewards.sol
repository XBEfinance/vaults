/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity ^0.4.24;

import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "@aragon/os/contracts/lib/math/Math.sol";
import "@aragon/minime/contracts/MiniMeToken.sol";

import "./interfaces/IVeXBE.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IVoting.sol";
import "./interfaces/IBoostLogicProvider.sol";

import "./utils/VotingPausable.sol";
import "./utils/VotingNonReentrant.sol";
import "./utils/VotingOwnable.sol";
import "./utils/VotingInitializable.sol";

contract VotingStakingRewards is VotingPausable, VotingNonReentrant, VotingOwnable, VotingInitializable {

    using SafeMath for uint256;
    using SafeMath64 for uint64;

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);

    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18
    uint256 internal constant maxBoostLevel = PCT_BASE;
    uint256 internal constant baseBoostLevel = PCT_BASE
        .mul(inverseMaxBoostCoefficient)
        .div(100);

    address public treasury;
    IVoting public voting;

    mapping(address => bool) internal _vaultsWhoCanAutoStake;

    struct BondedReward {
        uint256 amount;
        uint256 unlockTime;
        bool requested;
    }


    mapping(address => mapping(address => bool)) public stakeAllowance;
    mapping(address => BondedReward) public bondedRewardLocks;

    uint256 public penaltyPct = 1 ether / 2; // PCT_BASE is 10^18
    uint256 public bondedLockDuration = 5 days;

    uint256 public inverseMaxBoostCoefficient = 40; // 1 / inverseMaxBoostCoefficient = max boost coef. (ex. if 40 then 1 / (40 / 100) = 2.5)

    address public rewardsToken;
    address public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    address public rewardsDistribution;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;

    address public token;
    IBoostLogicProvider public boostLogicProvider;

    function configure(
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        uint256 _rewardsDuration,
        address _token,
        address _voting,
        address _boostLogicProvider,
        address[] memory __vaultsWhoCanAutostake
    ) public initializer {
        rewardsToken = _rewardsToken;
        stakingToken = _stakingToken;
        rewardsDistribution = _rewardsDistribution;
        rewardsDuration = _rewardsDuration;
        token = _token;
        voting = IVoting(_voting);
        boostLogicProvider = IBoostLogicProvider(_boostLogicProvider);
        for (uint256 i = 0; i < __vaultsWhoCanAutostake.length; i++) {
            _vaultsWhoCanAutoStake[__vaultsWhoCanAutostake[i]] = true;
        }
    }

    modifier onlyRewardsDistribution {
        require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
        _;
    }

    function setInverseMaxBoostCoefficient(uint256 _inverseMaxBoostCoefficient)
        external
        onlyOwner
    {
        inverseMaxBoostCoefficient = _inverseMaxBoostCoefficient;
        require(_inverseMaxBoostCoefficient > 0 && _inverseMaxBoostCoefficient < 100, "invalidInverseMaxBoostCoefficient");
    }

    function setPenaltyPct(uint256 _penaltyPct)
        external
        onlyOwner
    {
        penaltyPct = _penaltyPct;
        require(_penaltyPct < PCT_BASE, "tooHighPct");
    }

    function setBondedLockDuration(uint256 _bondedLockDuration)
        external
        onlyOwner
    {
        bondedLockDuration = _bondedLockDuration;
    }

    function setBoostLogicProvider(address _boostLogicProvider)
        external
        onlyOwner
    {
        boostLogicProvider = IBoostLogicProvider(_boostLogicProvider);
    }


    /* ========== VIEWS ========== */

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min256(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
            );
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    uint256 public totalReward;

    function notifyRewardAmount(uint256 reward) external onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }
        totalReward = totalReward.add(reward);

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = IERC20(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance.div(rewardsDuration), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        _updateReward(account);
        _;
    }

    function _updateReward(address account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            uint256 boostLevel = calculateBoostLevel(account);
            var (userEarned, toTreasury) = _earned(account, boostLevel);
            rewards[account] = userEarned;
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
            // transfer remaining reward share to treasury
            require(IERC20(stakingToken).transfer(treasury, toTreasury), "!boostDelta");
        }
    }

    function _stake(address _from, uint256 _amount) internal {
        require(_amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(_amount);
        _balances[_from] = _balances[_from].add(_amount);

        require(IERC20(stakingToken).transferFrom(msg.sender, address(this), _amount), "!t");
        emit Staked(_from, _amount);
    }

    function setAllowanceOfStaker(address _staker, bool _allowed) external {
        stakeAllowance[_staker][msg.sender] = _allowed;
    }

    function setStrategyWhoCanAutoStake(address _addr, bool _flag) external onlyRewardsDistribution {
        _vaultsWhoCanAutoStake[_addr] = _flag;
    }

    function stakeFor(address _for, uint256 amount)
        public
        nonReentrant whenNotPaused
        updateReward(_for)
    {
        if (!_vaultsWhoCanAutoStake[msg.sender]) {
            require(stakeAllowance[msg.sender][_for], "stakeNotApproved");
        }

        _stake(_for, amount);

        BondedReward memory rewardLock = bondedRewardLocks[_for];
        bool unbondOld = rewardLock.requested && block.timestamp > rewardLock.unlockTime;

        bondedRewardLocks[_for] = BondedReward({
          amount: unbondOld ? amount : rewardLock.amount + amount,
          unlockTime: block.timestamp + bondedLockDuration,
          requested: false
        });
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        _stake(msg.sender, amount);
    }

    function assertEscrow(address _addr, uint256 _available, uint256 _withdrawAmount) internal view {
        uint256 escrowed = IVeXBE(token).lockedAmount(_addr);
        require(_available.sub(_withdrawAmount) >= escrowed, "escrow amount failure");
    }

    function requestWithdrawBonded() public nonReentrant updateReward(msg.sender) {
        require(!bondedRewardLocks[msg.sender].requested, "alreadyRegistered");
        uint256 bondedAmount = bondedRewardLocks[msg.sender].amount;
        require(bondedAmount > 0, "notEnoughBondedTokens");
        bondedRewardLocks[msg.sender].requested = true;
    }

    function withdrawBondedOrWithPenalty() public nonReentrant updateReward(msg.sender) {
        require(bondedRewardLocks[msg.sender].requested, "needsToBeRequested");
        uint256 amount = bondedRewardLocks[msg.sender].amount;

        assertEscrow(msg.sender, _balances[msg.sender], amount);

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        if (block.timestamp > bondedRewardLocks[msg.sender].unlockTime) {
            require(IERC20(stakingToken).transfer(msg.sender, amount), "!tBonded");
        } else {
            uint256 toTransfer = amount.mul(penaltyPct).div(PCT_BASE);
            uint256 penalty = amount.sub(toTransfer);
            require(IERC20(stakingToken).transfer(msg.sender, toTransfer), "!tBondedWithPenalty");
            require(IERC20(stakingToken).transfer(treasury, penalty), "!tPenalty");
        }
        delete bondedRewardLocks[msg.sender];
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawUnbonded(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");

        assertEscrow(msg.sender, _balances[msg.sender], amount);

        if (bondedRewardLocks[msg.sender].amount > 0) {
            require(amount <= _balances[msg.sender].sub(bondedRewardLocks[msg.sender].amount), "cannotWithdrawBondedTokens");
        }

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);

        require(IERC20(stakingToken).transfer(msg.sender, amount), "!t");

        emit Withdrawn(msg.sender, amount);
    }

    function _rewardPerTokenForDuration(uint256 duration) internal view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                duration.mul(rewardRate).mul(1e18).div(_totalSupply)
            );
    }

    function potentialXbeReturns(uint256 duration) public view returns (uint256) {
        uint256 _rewardsAmount = _balances[msg.sender]
            .mul(
                _rewardPerTokenForDuration(duration).sub(userRewardPerTokenPaid[msg.sender]))
            .div(1e18)
            .add(rewards[msg.sender]);
        return _rewardsAmount;
    }

    function _lockedBoostLevel(address account) internal view returns(uint256) {
        IVeXBE veXBE = IVeXBE(token);
        uint256 votingBalance = veXBE.balanceOf(account);
        uint256 votingTotal = veXBE.totalSupply();
        uint256 userLock = veXBE.lockedAmount(account);
        if (votingTotal == 0 || votingBalance == 0) {
            return PCT_BASE
                .mul(inverseMaxBoostCoefficient)
                .div(100);
        }

        uint256 res = PCT_BASE.mul(
            inverseMaxBoostCoefficient.add(
                uint256(100).sub(inverseMaxBoostCoefficient)
                .mul(veXBE.lockedSupply())
                .mul(votingBalance)
                .div(votingTotal)
                .div(userLock)
            )
        ).div(100);

        return res < PCT_BASE ? res : PCT_BASE;
    }

    function _calculateBoostLevel(address account) internal view returns (uint256) {
        IVeXBE veXBE = IVeXBE(token);
        uint256 userLock = veXBE.lockedAmount(account);

        uint256 userStake = _balances[account];
        if (userStake == 0 || userLock == 0) {
            return baseBoostLevel;
        }

        uint256 lockedBoost = IBoostLogicProvider(boostLogicProvider).hasMaxBoostLevel(account) ?
            maxBoostLevel : _lockedBoostLevel(account);

        return lockedBoost.mul(userLock)
            .add(
                baseBoostLevel.mul(userStake.sub(userLock))
            )
            .div(userStake);
    }

    function calculateBoostLevel(address account) public view returns (uint256) {
        return _calculateBoostLevel(account);
    }

    function _earned(address account, uint256 boostLevel)
        internal view
        returns (uint256, uint256) // userEarned, toTreasury
    {
        require(boostLevel < maxBoostLevel, 'badBoostLevel');

        uint256 maxBoostedReward = _balances[account]
            .mul(
                rewardPerToken().sub(userRewardPerTokenPaid[account])
            ).div(1e18);

        uint256 toUser = maxBoostedReward.mul(boostLevel).div(1e18);
        uint256 toTreasury = maxBoostedReward.sub(toUser);

        return (toUser.add(rewards[account]), toTreasury);
    }

    function earned(address account) public view returns (uint256) {
        uint256 boostLevel = calculateBoostLevel(account);
        (uint256 userEarned, ) = _earned(account, boostLevel);
        return userEarned;
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(IERC20(rewardsToken).transfer(msg.sender, reward), "!t");
            totalReward = totalReward.sub(reward);
            emit RewardPaid(msg.sender, reward);
        }
    }
}
