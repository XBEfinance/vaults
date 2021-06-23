pragma solidity ^0.6.0;

import "./interfaces/minting/IMint.sol";
import "./interfaces/IVotingEscrow.sol";
import "./staking_rewards/StakingRewards.sol";

contract BonusCampaign is StakingRewards {

    uint256 public bonusEmission;
    uint256 public startMintTime;
    uint256 public stopRegisterTime;

    mapping(address => bool) public registered;

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

    function register() external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(block.timestamp <= stopRegisterTime, "registerNowIsBlocked");
        require(!registered[msg.sender], "alreadyRegistered");
        // avoid double staking in this very block by substracting one from block.number
        IVotingEscrow veToken = IVotingEscrow(stakingToken);
        uint256 amount = veToken.balanceOfAt(msg.sender, _toUint64(block.number) - 1);
        require(amount > 0, "!stake0");
        require(veToken.lockedEnd(msg.sender).sub(veToken.lockStarts(msg.sender)) >= rewardsDuration, "stakedForNotEnoughTime");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        registered[msg.sender] = true;
        emit Staked(msg.sender, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) {
        require(block.timestamp >= periodFinish, "isNotYetFinished");
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            IERC20(rewardsToken).safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function startMint() external onlyRewardsDistribution updateReward(address(0)) {
        require(block.timestamp >= startMintTime, "cannotMintYet");
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

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        _mintStarted = true;
        emit RewardAdded(bonusEmission);
    }


}
