/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "@aragon/os/contracts/lib/math/Math.sol";
import "@aragon/minime/contracts/MiniMeToken.sol";

import "./interfaces/IBonusCampaign.sol";
import "./interfaces/IVeXBE.sol";
import "./interfaces/IERC20.sol";

contract VotingStakingRewards {

    using SafeMath for uint256;
    using SafeMath64 for uint64;

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);

    uint64 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18

    IBonusCampaign public bonusCampaign;
    address public treasury;

    mapping(address => bool) internal _strategiesWhoCanAutostake;

    struct BondedReward {
        uint256 amount;
        uint256 unlockTime;
        bool requested;
    }

    mapping(address => uint256) public voteLock;
    bool public breaker = false;

    mapping(address => mapping(address => bool)) public stakeAllowance;
    mapping(address => BondedReward) public bondedRewardLocks;

    uint256 public penaltyPct = 1 ether / 2; // PCT_BASE is 10^18
    uint256 public bondedLockDuration = 5 days;

    uint256 public inverseMaxBoostCoefficient = 40; // 1 / inverseMaxBoostCoefficient = max boost coef. (ex. if 40 then 1 / (40 / 100) = 2.5)

    address public rewardsToken;
    address public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration; //= 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    address public rewardsDistribution;

    bool public paused;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;

    MiniMeToken public token;

    function _configureRewards(
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        uint256 _rewardsDuration,
        address[] memory __strategiesWhoCanAutostake
    ) internal {
        rewardsToken = _rewardsToken;
        stakingToken = _stakingToken;
        rewardsDistribution = _rewardsDistribution;
        rewardsDuration = _rewardsDuration;
        for (uint256 i = 0; i < __strategiesWhoCanAutostake.length; i++) {
            _strategiesWhoCanAutostake[__strategiesWhoCanAutostake[i]] = true;
        }
    }

    modifier nonReentrant {
        // On the first call to nonReentrant, _notEntered will be true
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    modifier whenNotPaused {
        require(!paused, "paused");
        _;
    }

    modifier onlyRewardsDistribution {
        require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
        _;
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

    function notifyRewardAmount(uint256 reward) external onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }

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
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function _stake(address _from, uint256 _amount) internal {
        require(_amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(_amount);
        _balances[_from] = _balances[_from].add(_amount);

        require(IERC20(stakingToken).transferFrom(_from, address(this), _amount), "!t");
        emit Staked(_from, _amount);
    }

    function setAllowanceOfStaker(address _staker, bool _allowed) external {
        stakeAllowance[_staker][msg.sender] = _allowed;
    }

    function setStrategyWhoCanAutoStake(address _addr, bool _flag) external onlyRewardsDistribution {
        _strategiesWhoCanAutostake[_addr] = _flag;
    }

    function stakeFor(address _for, uint256 amount) public nonReentrant whenNotPaused updateReward(_for) {
        if (_strategiesWhoCanAutostake[msg.sender]) {
            require(stakeAllowance[msg.sender][_for], "stakeNotApproved");
        }
        _stake(_for, amount);
        bondedRewardLocks[msg.sender] = BondedReward({
          amount: bondedRewardLocks[msg.sender].amount + amount,
          unlockTime: block.timestamp + bondedLockDuration,
          requested: false
        });
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        _stake(msg.sender, amount);
    }

    function requestWithdrawBonded(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(!bondedRewardLocks[msg.sender].requested, "alreadyRegistered");
        require(amount > 0, "Cannot request to withdraw 0");
        uint256 bondedAmount = bondedRewardLocks[msg.sender].amount;
        require(bondedAmount > 0 && amount <= bondedAmount, "notEnoughBondedTokens");
        if (!breaker) {
            require(voteLock[msg.sender] < block.number, "!locked");
        }
        bondedRewardLocks[msg.sender].requested = true;
    }

    function withdrawBondedOrWithPenalty() public nonReentrant updateReward(msg.sender) {
        require(bondedRewardLocks[msg.sender].requested, "needsToBeRequested");
        uint256 amount = bondedRewardLocks[msg.sender].amount;
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
        if (bondedRewardLocks[msg.sender].amount > 0) {
            require(amount <= _balances[msg.sender].sub(bondedRewardLocks[msg.sender].amount), "cannotWithdrawBondedTokens");
        }
        if (!breaker) {
            require(voteLock[msg.sender] < block.number, "!locked");
        }
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);

        require(IERC20(stakingToken).transfer(msg.sender, amount), "!t");

        emit Withdrawn(msg.sender, amount);
    }

    function calculateBoostLevel(address account, uint256 precision) external view returns (uint256) {
        uint256 maxBoostedReward = _balances[account]
          .mul(
            rewardPerToken().sub(userRewardPerTokenPaid[account])
          )
          .div(1e18)
          .add(rewards[account]);

        uint256 reward = _earned(account, maxBoostedReward);
        // real boost level = reward.div(maxBoostedReward) # [0.4 .. 1]
        // inversed = maxBoostedReward.div(reward) # [1 .. 2.5]
        // multiplied by precision coeff: precision.mul(maxBoostedReward).div(reward)

        return precision.mul(maxBoostedReward).div(reward);
    }

    function _earned(address account, uint256 maxBoostedReward) internal view returns (uint256) {
        IVeXBE veXBE = IVeXBE(address(token));
        uint256 lockDuration = veXBE.lockedEnd(account) - veXBE.lockStarts(account);
        // if lockup is 23 months or more
        if (lockDuration >= bonusCampaign.rewardsDuration() && block.timestamp < bonusCampaign.periodFinish()) {
            return maxBoostedReward;
        }

        uint256 lpTotal = totalSupply();
        uint256 votingBalance = veXBE.balanceOf(account);
        uint256 votingTotal = veXBE.totalSupply();

        uint256 boostedReward = maxBoostedReward * inverseMaxBoostCoefficient / 100;
        if (votingTotal == 0 || votingBalance == 0) {
            return boostedReward;
        }
        boostedReward += lpTotal * votingBalance / votingTotal * (100 - inverseMaxBoostCoefficient) / 100;
        return Math.min256(boostedReward, maxBoostedReward);
    }

    function earned(address account) public view returns (uint256) {
        uint256 maxBoostedReward = _balances[account]
          .mul(
            rewardPerToken().sub(userRewardPerTokenPaid[account])
          )
          .div(1e18)
          .add(rewards[account]);

        return _earned(account, maxBoostedReward);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        if (!breaker) {
            require(voteLock[msg.sender] > block.number, "!voted");
        }
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(IERC20(rewardsToken).transfer(msg.sender, reward), "!t");
            emit RewardPaid(msg.sender, reward);
        }
    }
}
