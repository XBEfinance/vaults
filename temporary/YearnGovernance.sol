pragma solidity ^0.6.0;

// Pool 3 / BPT
contract YearnGovernance is LPTokenWrapper, IRewardDistributionRecipient {

    /* Fee collection for any other token */

    function seize(IERC20 _token, uint amount) external {
        require(msg.sender == governance, "!governance");
        require(_token != feesPaidIn, "feesPaidIn");
        require(_token != yfi, "yfi");
        require(_token != bpt, "bpt");
        _token.safeTransfer(governance, amount);
    }

    /* Fees breaker, to protect withdraws if anything ever goes wrong */

    bool public breaker = false;

    function setBreaker(bool _breaker) external {
        require(msg.sender == governance, "!governance");
        breaker = _breaker;
    }

    /* Modifications for fees claimable */

    uint256 public yIndex = 0; // previously accumulated index
    uint256 public yBal = 0; // previous calculated balance of COMP

    mapping(address => uint256) public ySupplyIndex;

    IERC20 public feesPaidIn = IERC20(0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8);

    function setReward(IERC20 _feesPaidIn) public {
        require(msg.sender == governance, "!governance");
        feesPaidIn = _feesPaidIn;
    }

    function claimFees() public {
        _claimFor(msg.sender);
    }

    function _claimFor(address recipient) internal {
        updateFees();
        uint256 _supplied = balanceOf(recipient);
        if (_supplied > 0) {
            uint256 _supplyIndex = ySupplyIndex[recipient];
            ySupplyIndex[recipient] = yIndex;
            uint256 _delta = yIndex.sub(_supplyIndex);
            if (_delta > 0) {
              uint256 _share = _supplied.mul(_delta).div(1e18);

              IERC20(feesPaidIn).safeTransfer(recipient, _share);
              yBal = IERC20(feesPaidIn).balanceOf(address(this));
            }
        } else {
            ySupplyIndex[recipient] = yIndex;
        }
    }

    function updateFees() public {
        if (totalSupply() > 0) {
            uint256 _yBal = IERC20(feesPaidIn).balanceOf(address(this));
            if (_yBal > 0) {
                uint256 _diff = _yBal.sub(yBal);
                if (_diff > 0) {
                    uint256 _ratio = _diff.mul(1e18).div(totalSupply());
                    if (_ratio > 0) {
                      yIndex = yIndex.add(_ratio);
                      yBal = _yBal;
                    }
                }
            }
        }
    }

    /* Modifications for proposals */

    mapping(address => uint) public voteLock; // period that your sake it locked to keep it for voting

    struct Proposal {
        uint id;
        address proposer;
        mapping(address => uint) forVotes;
        mapping(address => uint) againstVotes;
        uint totalForVotes;
        uint totalAgainstVotes;
        uint start; // block start;
        uint end; // start + period
    }

    mapping (uint => Proposal) public proposals;
    uint public proposalCount;
    uint public period = 17280; // voting period in blocks ~ 17280 3 days for 15s/block
    uint public lock = 17280; // vote lock in blocks ~ 17280 3 days for 15s/block
    uint public minimum = 1e18;
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

    function setPeriod(uint _period) public {
        require(msg.sender == governance, "!governance");
        period = _period;
    }

    function setLock(uint _lock) public {
        require(msg.sender == governance, "!governance");
        lock = _lock;
    }

    function initialize() public {
        require(config == true, "!config");
        config = false;
        governance = msg.sender;
    }

    function propose() public {
        require(balanceOf(msg.sender) > minimum, "<minimum");
        proposals[proposalCount++] = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            totalForVotes: 0,
            totalAgainstVotes: 0,
            start: block.number,
            end: period.add(block.number)
        });

        voteLock[msg.sender] = lock.add(block.number);
    }

    function voteFor(uint id) public {
        require(proposals[id].start < block.number , "<start");
        require(proposals[id].end > block.number , ">end");
        uint votes = balanceOf(msg.sender).sub(proposals[id].forVotes[msg.sender]);
        proposals[id].totalForVotes = proposals[id].totalForVotes.add(votes);
        proposals[id].forVotes[msg.sender] = balanceOf(msg.sender);

        voteLock[msg.sender] = lock.add(block.number);

        if (breaker == false) {
            claimFees();
        }
    }

    function voteAgainst(uint id) public {
        require(proposals[id].start < block.number , "<start");
        require(proposals[id].end > block.number , ">end");
        uint votes = balanceOf(msg.sender).sub(proposals[id].againstVotes[msg.sender]);
        proposals[id].totalAgainstVotes = proposals[id].totalAgainstVotes.add(votes);
        proposals[id].againstVotes[msg.sender] = balanceOf(msg.sender);

        voteLock[msg.sender] = lock.add(block.number);

        if (breaker == false) {
            claimFees();
        }
    }

    /* Default rewards contract */

    IERC20 public yfi = IERC20(0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e);

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
            claimFees();
        }
        super.stake(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        if (breaker == false) {
            require(voteLock[msg.sender] < block.number,"!locked");
            claimFees();
        }
        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            yfi.safeTransfer(msg.sender, reward);
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
