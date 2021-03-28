pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "./Governable.sol";
import "./LPTokenWrapper.sol";
import "../interfaces/IRewardDistributionRecipient.sol";
import "../interfaces/IExecutor.sol";


/// @title Governance
/// @notice
/// @dev
contract Governance is Governable, IRewardDistributionRecipient, LPTokenWrapper, Initializable {

    /// @notice The Proposal struct used to represent vote process.
    struct Proposal {
        uint256 id; // Unique ID of the proposal (here Counter lib can be used)
        address proposer; // An address who created the proposal
        mapping(address => uint256) forVotes; // Percentage (in base points) of governance token (votes) of 'for' side
        mapping(address => uint256) againstVotes; // Percentage (in base points) of governance token (votes) of 'against' side
        uint256 totalForVotes; // Total amount of governance token (votes) in side 'for'
        uint256 totalAgainstVotes; // Total amount of governance token (votes) in side 'against'
        uint256 start; // Block start
        uint256 end; // Start + period
        address executor; // Custom contract which can execute changes regarding to voting process end
        string hash; // An IPFS hash of the proposal document
        uint256 totalVotesAvailable; // Total amount votes that are not in voting process
        uint256 quorum; // Current quorum (in base points)
        uint256 quorumRequired; // Quorum to end the voting process
        bool open; // Proposal status
    }

    /// @notice Emits when new proposal is created
    /// @param _id ID of the proposal
    /// @param _creator Address of proposal creator
    /// @param _start Voting process start timestamp
    /// @param _duration Milliseconds during which the voting process occurs
    /// @param _executor Address of the the executor contract
    event NewProposal(uint256 _id, address _creator, uint256 _start, uint256 _duration, address _executor);

    /// @notice Emits when someone votes in proposal
    /// @param _id ID of the proposal
    /// @param _voter Voter address
    /// @param _vote 'For' or 'Against' vote type
    /// @param _weight Vote weight in percents (in base points)
    event Vote(uint256 indexed _id, address indexed _voter, bool _vote, uint256 _weight);

    /// @notice Emits when voting process finished
    /// @param _id ID of the proposal
    /// @param _for 'For' votes percentage in base points
    /// @param _against 'Against' votes percentage in base points
    /// @param _quorumReached Is quorum percents are above or equal to required quorum? (bool)
    event ProposalFinished(uint256 indexed _id, uint256 _for, uint256 _against, bool _quorumReached);

    /// @notice Emits when voter invoke registration method
    /// @param _voter Voter address
    /// @param _votes Governance tokens number to be placed as votes
    /// @param _totalVotes Total governance token placed as votes for all users
    event RegisterVoter(address _voter, uint256 _votes, uint256 _totalVotes);

    /// @notice Emits when voter invoke revoke method
    /// @param _voter Voter address
    /// @param _votes Governance tokens number to be removed as votes
    /// @param _totalVotes Total governance token removed as votes for all users
    event RevokeVoter(address _voter, uint256 _votes, uint256 _totalVotes);

    /// @notice Emits when reward for participation in voting processes is sent to governance contract
    /// @param _reward Amount of staking reward tokens
    event RewardAdded(uint256 _reward);

    /// @notice Emits when sum of governance token staked to governance contract
    /// @param _user User who stakes
    /// @param _amount Amount of governance token to stake
    event Staked(address indexed _user, uint256 _amount);

    /// @notice Emits when sum of governance token withdrawn from governance contract
    /// @param _user User who withdraw
    /// @param _amount Amount of governance token to withdraw
    event Withdrawn(address indexed _user, uint256 _amount);

    /// @notice Emits when reward for participation in voting processes is sent to user.
    /// @param _user Voter who receive rewards
    /// @param _reward Amount of staking reward tokens
    event RewardPaid(address indexed _user, uint256 _reward);

    /// @notice Period that your sake is locked to keep it for voting
    /// @dev voter => lock period
    mapping(address => uint256) public voteLock;

    /// @notice Exists to store proposals
    /// @dev id => proposal struct
    mapping(uint256 => Proposal) public proposals;

    /// @notice Amount of governance tokens staked as votes for each voter
    /// @dev voter => token amount
    mapping(address => uint256) public votes;

    /// @notice Exists to check if voter registered
    /// @dev user => is voter?
    mapping(address => bool) public voters;

    /// @notice Exists to keep history of rewards paid
    /// @dev voter => reward paid
    mapping(address => uint256) public userRewardPerTokenPaid;

    /// @notice Exists to track amounts of reward to be paid
    /// @dev voter => reward to pay
    mapping(address => uint256) public rewards;

    /// @notice Allow users to claim rewards instantly regardless of any voting process
    /// @dev Link (https://gov.yearn.finance/t/yip-47-release-fee-rewards/6013)
    bool public breaker = false;

    /// @notice Exists to generate ids for new proposals
    uint256 public proposalCount;

    /// @notice Voting period in blocks ~ 17280 3 days for 15s/block
    uint256 public period = 17280;

    /// @notice Vote lock in blocks ~ 17280 3 days for 15s/block
    uint256 public lock = 17280;

    /// @notice Minimal amount of governance token to allow proposal creation
    uint256 public minimum = 1e18;

    /// @notice Default quorum required in base points
    uint256 public quorum = 2000;

    /// @notice Total amount of governance tokens staked
    uint256 public totalVotes;

    /// @notice Token in which reward for voting will be paid
    IERC20 public rewardsToken;

    /// @notice Default duration of the voting process in milliseconds
    uint256 public constant DURATION = 7 days;

    /// @notice Time period in milliseconds during which rewards are paid
    uint256 public periodFinish = 0;

    /// @notice This variable regulates amount of staking reward token to be paid, it depends from period finish. The last claims the lowest reward
    uint256 public rewardRate = 0;

    /// @notice Amount of staking reward token per governance token staked
    uint256 public rewardPerTokenStored = 0;

    /// @notice Last time when rewards was added and recalculated
    uint256 public lastUpdateTime;

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _startId Starting ID (default 0)
    /// @param _rewardsTokenAddress Token in which rewards are paid
    /// @param _governance Governance address
    /// @param _governanceToken Governance token address
    function configure(
            uint256 _startId,
            address _rewardsTokenAddress,
            address _governance,
            address _governanceToken,
            address _rewardDistribution
    ) external initializer {
        proposalCount = _startId;
        rewardsToken = IERC20(_rewardsTokenAddress);
        _setGovernanceToken(_governanceToken);
        setGovernance(_governance);
        setRewardDistribution(_rewardDistribution);
    }

    /// @dev This methods evacuates given funds to governance address
    /// @param _token Exact token to evacuate
    /// @param _amount Amount of token to evacuate
    function seize(IERC20 _token, uint256 _amount) external onlyGovernance {
        require(_token != rewardsToken, "!rewardsToken");
        require(_token != governanceToken, "!governanceToken");
        _token.safeTransfer(governance, _amount);
    }

    /// @notice Usual setter
    /// @param _breaker New value
    function setBreaker(bool _breaker) external onlyGovernance {
        breaker = _breaker;
    }

    /// @notice Usual setter
    /// @param _quorum New value
    function setQuorum(uint256 _quorum) external onlyGovernance {
        quorum = _quorum;
    }

    /// @notice Usual setter
    /// @param _minimum New value
    function setMinimum(uint256 _minimum) external onlyGovernance {
        minimum = _minimum;
    }

    /// @notice Usual setter
    /// @param _period New value
    function setPeriod(uint256 _period) external onlyGovernance {
        period = _period;
    }

    /// @notice Usual setter
    /// @param _lock New value
    function setLock(uint256 _lock) external onlyGovernance {
        lock = _lock;
    }

    /// @notice Allows msg.sender exit from the whole governance process and withdraw all his rewards and governance tokens
    function exit() external {
        withdraw(balanceOf(_msgSender()));
        getReward();
    }

    /// @notice Adds to governance contract staking reward tokens to be sent to vote process participants.
    /// @param _reward Amount of staking rewards token in wei
    function notifyRewardAmount(uint256 _reward)
        external
        onlyRewardDistribution
        override
        updateReward(address(0))
    {
        IERC20(rewardsToken).safeTransferFrom(_msgSender(), address(this), _reward);
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

    /// @notice Creates a proposal to vote
    /// @param _executor Executor contract address
    /// @param _hash IPFS hash of the proposal document
    function propose(address _executor, string memory _hash) public {
        require(votesOf(_msgSender()) > minimum, "<minimum");
        proposals[proposalCount] = Proposal({
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
        emit NewProposal(
            proposalCount,
            _msgSender(),
            block.number,
            period,
            _executor
        );
        proposalCount++;
        voteLock[_msgSender()] = lock.add(block.number);
    }

    /// @notice Called by third party to execute the proposal conditions
    /// @param _id ID of the proposal
    function execute(uint256 _id) public {
        (uint256 _for, uint256 _against, uint256 _quorum) = getStats(_id);
        require(proposals[_id].quorumRequired < _quorum, "!quorum");
        require(proposals[_id].end < block.number , "!end");
        if (proposals[_id].open) {
            tallyVotes(_id);
        }
        IExecutor(proposals[_id].executor).execute(_id, _for, _against, _quorum);
    }

    /// @notice Called by anyone to obtain the voting process statistics for specific proposal
    /// @param _id ID of the proposal
    /// @return _for 'For' percentage in base points
    /// @return _against 'Against' percentage in base points
    /// @return _quorum Current quorum percentage in base points
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
        if (_total == 0) {
          _quorum = 0;
        } else {
          _for = _for.mul(10000).div(_total);
          _against = _against.mul(10000).div(_total);
          _quorum = _total.mul(10000).div(proposals[_id].totalVotesAvailable);
        }
    }

    /// @notice Synonimus name countVotes, called to stop voting process
    /// @param _id ID of the proposal to be closed
    function tallyVotes(uint256 _id) public {
        require(proposals[_id].open, "!open");
        require(proposals[_id].end < block.number, "!end");
        (uint256 _for, uint256 _against,) = getStats(_id);
        proposals[_id].open = false;
        emit ProposalFinished(
            _id,
            _for,
            _against,
            proposals[_id].quorum >= proposals[_id].quorumRequired
        );
    }

    /// @notice Called to obtain votes count for specific voter
    /// @param _voter To whom votes related
    /// @return Governance token staked to governance contract as votes
    function votesOf(address _voter) public view returns(uint256) {
        return votes[_voter];
    }

    /// @notice Registers new user as voter and adds his votes
    function register() public {
        require(!voters[_msgSender()], "voter");
        voters[_msgSender()] = true;
        votes[_msgSender()] = balanceOf(_msgSender());
        totalVotes = totalVotes.add(votes[_msgSender()]);
        emit RegisterVoter(_msgSender(), votes[_msgSender()], totalVotes);
    }

    /// @notice Nullify (revoke) all the votes staked by msg.sender
    function revoke() public {
        require(voters[_msgSender()], "!voter");
        voters[_msgSender()] = false;

        /// @notice Edge case dealt with in openzeppelin trySub methods.
        /// The case should be impossible, but this is defi.
        (,totalVotes) = totalVotes.trySub(votes[_msgSender()]);

        emit RevokeVoter(_msgSender(), votes[_msgSender()], totalVotes);
        votes[_msgSender()] = 0;
    }

    /// @notice Allow registered voter to vote 'for' proposal
    /// @param _id Proposal id
    function voteFor(uint256 _id) public {
        require(proposals[_id].start < block.number, "<start");
        require(proposals[_id].end > block.number, ">end");

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

    /// @notice Allow registered voter to vote 'against' proposal
    /// @param _id Proposal id
    function voteAgainst(uint256 _id) public {
        require(proposals[_id].start < block.number, "<start");
        require(proposals[_id].end > block.number, ">end");

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

    /// @dev Modifier to update stats when reward either sent to governance contract or to voter
    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    /// @notice Dynamic finish time getter
    /// @return Recalculated time when voting process needs to be finished
    function lastTimeRewardApplicable() public view returns(uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    /// @notice Dynamic reward per token amount getter
    /// @return Recalculated amount of staking reward tokens per governance token
    function rewardPerToken() public view returns(uint256) {
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

    /// @notice Calculate the size of reward for voter
    /// @param _account Voter address
    /// @return Amount of exact staking reward tokens to be paid
    function earned(address _account) public view returns(uint256) {
        return
            balanceOf(_account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[_account]))
                .div(1e18)
                .add(rewards[_account]);
    }

    /// @notice Allow to add new governance tokens to voter weight, simultaneosly it recalculates reward size according to new weight
    /// @param _amount Amount of governance token to stake
    function stake(uint256 _amount) public override updateReward(_msgSender()) {
        require(_amount > 0, "!stake 0");
        if (voters[_msgSender()]) {
            votes[_msgSender()] = votes[_msgSender()].add(_amount);
            totalVotes = totalVotes.add(_amount);
        }
        super.stake(_amount);
        emit Staked(_msgSender(), _amount);
    }


    /// @notice Allow to remove old governance tokens from voter weight, simultaneosly it recalculates reward size according to new weight
    /// @param _amount Amount of governance token to withdraw
    function withdraw(uint256 _amount) public override updateReward(_msgSender()) {
        require(_amount > 0, "!withdraw 0");
        if (voters[_msgSender()]) {
            votes[_msgSender()] = votes[_msgSender()].sub(_amount);
            totalVotes = totalVotes.sub(_amount);
        }
        if (!breaker) {
            require(voteLock[_msgSender()] < block.number, "!locked");
        }
        super.withdraw(_amount);
        emit Withdrawn(_msgSender(), _amount);
    }

    /// @notice Transfer staking reward tokens to voter (msg.sender), simultaneosly it recalculates reward size according to new weight and rewards remaining
    function getReward() public updateReward(_msgSender()) {
        if (!breaker) {
            require(voteLock[_msgSender()] > block.number, "!voted");
        }
        uint256 reward = earned(_msgSender());
        if (reward > 0) {
            rewards[_msgSender()] = 0;
            rewardsToken.transfer(_msgSender(), reward);
            emit RewardPaid(_msgSender(), reward);
        }
    }
}
