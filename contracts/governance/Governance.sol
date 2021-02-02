pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

import "./Governable.sol";
import "./LPTokenWrapper.sol";
import "./interfaces/IRewardDistributionRecipient.sol";
import "./interfaces/IExecutor.sol";
import "../templates/Initializable.sol";

contract Governance is Governable, IRewardDistributionRecipient, LPTokenWrapper, Initializable {

    struct Proposal {
        uint256 id;
        address proposer;
        mapping(address => uint256) forVotes;
        mapping(address => uint256) againstVotes;
        uint256 totalForVotes;
        uint256 totalAgainstVotes;
        uint256 start; // block start;
        uint256 end; // start + period
        address executor;
        string hash;
        uint256 totalVotesAvailable;
        uint256 quorum;
        uint256 quorumRequired;
        bool open;
    }

    event NewProposal(uint256 _id, address _creator, uint256 _start, uint256 _duration, address _executor);
    event Vote(uint256 indexed _id, address indexed _voter, bool _vote, uint256 _weight);
    event ProposalFinished(uint256 indexed _id, uint256 _for, uint256 _against, bool _quorumReached);
    event RegisterVoter(address _voter, uint256 _votes, uint256 _totalVotes);
    event RevokeVoter(address _voter, uint256 _votes, uint256 _totalVotes);

    event RewardAdded(uint256 _reward);
    event Staked(address indexed _user, uint256 _amount);
    event Withdrawn(address indexed _user, uint256 _amount);
    event RewardPaid(address indexed _user, uint256 _reward);

    mapping(address => uint256) public voteLock; // period that your sake it locked to keep it for voting
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public votes;
    mapping(address => bool) public voters;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    bool public breaker = false;
    uint256 public proposalCount;
    uint256 public period = 17280; // voting period in blocks ~ 17280 3 days for 15s/block
    uint256 public lock = 17280; // vote lock in blocks ~ 17280 3 days for 15s/block
    uint256 public minimum = 1e18; // minimal amount of governance token to allow proposal creation
    uint256 public quorum = 2000;
    uint256 public totalVotes;

    IERC20 public stakingRewardsToken;
    uint256 public constant DURATION = 7 days;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    constructor() public Initializable() {}

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    function initialize(
            uint256 _startId,
            address _stakingRewardsTokenAddress,
            address _governance,
            address _governanceToken
    ) public initializer {
        proposalCount = _startId;
        stakingRewardsToken = IERC20(_stakingRewardsTokenAddress);
        setGovernance(_governance);
        _setGovernanceToken(_governanceToken);
    }

    function setBreaker(bool _breaker) external onlyGovernance {
        breaker = _breaker;
    }

    function setQuorum(uint256 _quorum) public onlyGovernance {
        quorum = _quorum;
    }

    function setMinimum(uint256 _minimum) public onlyGovernance {
        minimum = _minimum;
    }

    function setPeriod(uint256 _period) public onlyGovernance {
        period = _period;
    }

    function setLock(uint256 _lock) public onlyGovernance {
        lock = _lock;
    }

    function seize(IERC20 _token, uint256 _amount) external onlyGovernance {
        require(_token != stakingRewardsToken, "A token must not be the staking rewards token.");
        require(_token != governanceToken, "A token must not be the governance token.");
        _token.safeTransfer(governance, _amount);
    }

    function propose(address _executor, string memory _hash) public {
        require(votesOf(_msgSender()) > minimum, "<minimum");
        proposals[proposalCount++] = Proposal({
            id: proposalCount,
            proposer: _msgSender(),
            totalForVotes: 0,
            totalAgainstVotes: 0,
            start: block.number,
            end: period.add(block.number),
            executor: _executor,
            hash: _hash,
            totalVotesAvailable: totalVotes,
            quorum: 0,
            quorumRequired: quorum,
            open: true
        });
        emit NewProposal(proposalCount, _msgSender(), block.number, period, _executor);
        voteLock[_msgSender()] = lock.add(block.number);
    }

    function execute(uint256 _id) public {
        (uint256 _for, uint256 _against, uint256 _quorum) = getStats(_id);
        require(proposals[_id].quorumRequired < _quorum, "!quorum");
        require(proposals[_id].end < block.number , "!end");
        if (proposals[_id].open == true) {
            tallyVotes(_id);
        }
        IExecutor(proposals[_id].executor).execute(_id, _for, _against, _quorum);
    }

    function getStats(uint256 _id)
        public
        view
        returns(
                uint256 _for,
                uint256 _against,
                uint256 _quorum
        )
    {
        _for = proposals[_id].totalForVotes;
        _against = proposals[_id].totalAgainstVotes;
        uint256 _total = _for.add(_against);
        _for = _for.mul(10000).div(_total);
        _against = _against.mul(10000).div(_total);
        _quorum = _total.mul(10000).div(proposals[_id].totalVotesAvailable);
    }

    // synonimus: countVotes
    function tallyVotes(uint256 _id) public {
        require(proposals[_id].open == true, "!open");
        require(proposals[_id].end < block.number, "!end");

        (uint256 _for, uint256 _against,) = getStats(_id);
        bool _quorum = false;
        if (proposals[_id].quorum >= proposals[_id].quorumRequired) {
            _quorum = true;
        }
        proposals[_id].open = false;
        emit ProposalFinished(_id, _for, _against, _quorum);
    }

    function votesOf(address _voter) public view returns(uint256) {
        return votes[_voter];
    }

    function register() public {
        require(voters[_msgSender()] == false, "voter");
        voters[_msgSender()] = true;
        votes[_msgSender()] = balanceOf(_msgSender());
        totalVotes = totalVotes.add(votes[_msgSender()]);
        emit RegisterVoter(_msgSender(), votes[_msgSender()], totalVotes);
    }

    function revoke() public {
        require(voters[_msgSender()] == true, "!voter");
        voters[_msgSender()] = false;
        if (totalVotes < votes[_msgSender()]) {
            //edge case, should be impossible, but this is defi
            totalVotes = 0;
        } else {
            totalVotes = totalVotes.sub(votes[_msgSender()]);
        }
        emit RevokeVoter(_msgSender(), votes[_msgSender()], totalVotes);
        votes[_msgSender()] = 0;
    }

    function voteFor(uint256 _id) public {
        require(proposals[_id].start < block.number , "<start");
        require(proposals[_id].end > block.number , ">end");

        uint256 _against = proposals[_id].againstVotes[_msgSender()];
        if (_against > 0) {
            proposals[_id].totalAgainstVotes = proposals[_id].totalAgainstVotes.sub(_against);
            proposals[_id].againstVotes[_msgSender()] = 0;
        }

        uint256 vote = votesOf(_msgSender()).sub(proposals[_id].forVotes[_msgSender()]);
        proposals[_id].totalForVotes = proposals[_id].totalForVotes.add(vote);
        proposals[_id].forVotes[_msgSender()] = votesOf(_msgSender());

        proposals[_id].totalVotesAvailable = totalVotes;
        uint256 _votes = proposals[_id].totalForVotes.add(proposals[_id].totalAgainstVotes);
        proposals[_id].quorum = _votes.mul(10000).div(totalVotes);

        voteLock[_msgSender()] = lock.add(block.number);

        emit Vote(_id, _msgSender(), true, vote);
    }

    function voteAgainst(uint256 _id) public {
        require(proposals[_id].start < block.number , "<start");
        require(proposals[_id].end > block.number , ">end");

        uint256 _for = proposals[_id].forVotes[_msgSender()];
        if (_for > 0) {
            proposals[_id].totalForVotes = proposals[_id].totalForVotes.sub(_for);
            proposals[_id].forVotes[_msgSender()] = 0;
        }

        uint256 vote = votesOf(_msgSender()).sub(proposals[_id].againstVotes[_msgSender()]);
        proposals[_id].totalAgainstVotes = proposals[_id].totalAgainstVotes.add(vote);
        proposals[_id].againstVotes[_msgSender()] = votesOf(_msgSender());

        proposals[_id].totalVotesAvailable = totalVotes;
        uint256 _votes = proposals[_id].totalForVotes.add(proposals[_id].totalAgainstVotes);
        proposals[_id].quorum = _votes.mul(10000).div(totalVotes);

        voteLock[_msgSender()] = lock.add(block.number);

        emit Vote(_id, _msgSender(), false, vote);
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

    function earned(address _account) public view returns (uint256) {
        return
            balanceOf(_account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[_account]))
                .div(1e18)
                .add(rewards[_account]);
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(uint256 _amount) public override updateReward(_msgSender()) {
        require(_amount > 0, "Cannot stake 0");
        if (voters[_msgSender()] == true) {
            votes[_msgSender()] = votes[_msgSender()].add(_amount);
            totalVotes = totalVotes.add(_amount);
        }
        super.stake(_amount);
        emit Staked(_msgSender(), _amount);
    }

    function withdraw(uint256 _amount) public override updateReward(_msgSender()) {
        require(_amount > 0, "Cannot withdraw 0");
        if (voters[_msgSender()] == true) {
            votes[_msgSender()] = votes[_msgSender()].sub(_amount);
            totalVotes = totalVotes.sub(_amount);
        }
        if (breaker == false) {
            require(voteLock[_msgSender()] < block.number,"!locked");
        }
        super.withdraw(_amount);
        emit Withdrawn(_msgSender(), _amount);
    }

    function exit() external {
        withdraw(balanceOf(_msgSender()));
        // getReward(); Un-comment this to enable the rewards.
    }

    function getReward() public updateReward(_msgSender()) {
        if (breaker == false) {
            require(voteLock[_msgSender()] > block.number,"!voted");
        }
        uint256 reward = earned(_msgSender());
        if (reward > 0) {
            rewards[_msgSender()] = 0;
            stakingRewardsToken.safeTransfer(_msgSender(), reward);
            emit RewardPaid(_msgSender(), reward);
        }
    }

    function notifyRewardAmount(uint256 _reward)
        external
        onlyRewardDistribution
        override
        updateReward(address(0))
    {
        IERC20(stakingRewardsToken).safeTransferFrom(_msgSender(), address(this), _reward);
        if (block.timestamp >= periodFinish) {
            rewardRate = _reward.div(DURATION);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = _reward.add(leftover).div(DURATION);
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(DURATION);
        emit RewardAdded(_reward);
    }
}
