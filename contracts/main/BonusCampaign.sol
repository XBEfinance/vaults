pragma solidity ^0.6.0;

import "./interfaces/minting/IMint.sol";
import "./interfaces/IVotingEscrow.sol";
import "./interfaces/ILockSubscriber.sol";
import "./staking_rewards/StakingRewards.sol";

contract BonusCampaign is StakingRewards, ILockSubscriber {

    uint256 public bonusEmission;
    uint256 public startMintTime;
    uint256 public stopRegisterTime;

    bool private _mintStarted;

    mapping(address => bool) public registered;

    address public registrator;

    function configure(
        address _rewardsToken,
        address _votingEscrowedToken,
        uint256 _startMintTime,
        uint256 _stopRegisterTime,
        uint256 _rewardsDuration,
        uint256 _bonusEmission
    ) external initializer {
        _configure(
            owner(),
            _rewardsToken,
            _votingEscrowedToken,
            _rewardsDuration
        );
        bonusEmission = _bonusEmission;
        startMintTime = _startMintTime;
        stopRegisterTime = _stopRegisterTime;
    }

    modifier onlyRegistrator() {
        require(msg.sender == registrator, "!registrator");
        _;
    }

    function processLockEvent(
        address account,
        uint256 lockStart,
        uint256 lockEnd,
        uint256 amount
    ) override external onlyRegistrator
    {
        if ((block.timestamp < periodFinish || periodFinish == 0)
            && (lockEnd.sub(lockStart) >= rewardsDuration)
            && _canRegister(account))
        {
            _registerFor(account);
        }
    }

    function setRegistrator(address _registrator) external onlyOwner {
        require(_registrator != address(0), "zeroAddress");
        registrator = _registrator;
    }

    function stake(uint256 amount) external override {
        revert("!allowed");
    }

    function withdraw(uint256 amount) public override {
        revert("!allowed");
    }

    function notifyRewardAmount(uint256 reward) external override {
        revert("!allowed");
    }

    function _toUint64(uint256 a) internal pure returns(uint64) {
        require(a <= uint256(uint64(-1)), "numberIsTooBig");
        return uint64(a);
    }

    function _canRegister(address account) internal view returns(bool) {
        return block.timestamp <= stopRegisterTime && !registered[account];
    }

    function canRegister(address account) external view returns(bool) {
        return _canRegister(account);
    }

    function _registerFor(address user)
        internal
        nonReentrant whenNotPaused
        updateReward(user)
    {
        require(block.timestamp <= stopRegisterTime, "registerNowIsBlocked");
        require(!registered[user], "alreadyRegistered");
        // avoid double staking in this very block by subtracting one from block.number
        IVotingEscrow veToken = IVotingEscrow(stakingToken);
        uint256 amount = veToken.balanceOfAt(user, _toUint64(block.number));
        require(amount > 0, "!stake0");
        require(veToken.lockedEnd(user).sub(veToken.lockStarts(user)) >= rewardsDuration, "stakedForNotEnoughTime");
        _totalSupply = _totalSupply.add(amount);
        _balances[user] = _balances[user].add(amount);
        registered[user] = true;
        emit Staked(user, amount);
    }

    function register() external {
        _registerFor(msg.sender);
    }

    function lastTimeRewardApplicable() public virtual override view returns (uint256) {
        return Math.max(startMintTime, Math.min(block.timestamp, periodFinish));
    }

    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            IERC20(rewardsToken).safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function evacuate(uint256 amount) external onlyOwner {
        IERC20(rewardsToken).safeTransfer(owner(), amount);
    }

    function startMint() external onlyRewardsDistribution updateReward(address(0)) {
        require(!_mintStarted, "mintAlreadyHappened");
        if (block.timestamp >= periodFinish) {
            rewardRate = bonusEmission.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = bonusEmission.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided bonusEmission amount is not more than the balance in the contract.
        // This keeps the bonusEmission rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.

        IMint(rewardsToken).mint(address(this), bonusEmission);

        uint256 balance = IERC20(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance.div(rewardsDuration), "Provided balance is too high");

        lastUpdateTime = startMintTime;
        periodFinish = startMintTime.add(rewardsDuration);
        _mintStarted = true;
        emit RewardAdded(bonusEmission);
    }

    function hasMaxBoostLevel(address account) external view returns (bool) {
        return
            (block.timestamp < periodFinish || periodFinish == 0)  // is campaign active or mint not started
            && registered[account];         // is user registered
    }
}
