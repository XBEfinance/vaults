pragma solidity ^0.6.0;


interface YearnGovernance {
    function balanceOf(address _owner) external returns (uint);
    function voteLock(address _owner) external returns (uint);
}


contract YearnFeeRewards is LPTokenWrapper, IRewardDistributionRecipient {

    /* Fee collection for any other token */

    function seize(IERC20 _token, uint amount) external {
        require(msg.sender == governance, "!governance");
        require(_token != yfi, "yfi");
        require(_token != yCRV, "bpt");
        _token.safeTransfer(governance, amount);
    }

     /* Fees breaker, to protect withdraws if anything ever goes wrong */

    bool public breaker = false;

    function setBreaker(bool _breaker) external {
        require(msg.sender == governance, "!governance");
        breaker = _breaker;
    }

    uint public minimum = 1000e18;
    bool public config = true;


    address public governance;

    function setGovernance(address _governance) public {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setMinimum(uint _minimum) public {
        require(msg.sender == governance, "!governance");
        minimum = _minimum;
    }

    function initialize() public {
        require(config == true, "!config");
        config = false;
        governance = msg.sender;
    }

    /* Default rewards contract */

    IERC20 public yCRV = IERC20(0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8);
    YearnGovernance public yGov = YearnGovernance(0x3A22dF48d84957F907e67F4313E3D43179040d6E);


    uint256 public constant DURATION = 7 days;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(totalSupply())
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        if (breaker == false) {
            require(yGov.balanceOf(msg.sender) > minimum, "<minimum");
            require(yGov.voteLock(msg.sender) > block.number, "<block.number");
        }
        super.stake(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) {
        if (breaker == false) {
            require(yGov.balanceOf(msg.sender) > minimum, "<minimum");
            require(yGov.voteLock(msg.sender) > block.number, "<block.number");
        }

        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            yCRV.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function notifyRewardAmount(uint256 reward)
        external
        onlyRewardDistribution
        updateReward(address(0))
    {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(DURATION);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(DURATION);
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(DURATION);
        emit RewardAdded(reward);
    }
}
