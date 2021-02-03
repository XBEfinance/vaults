/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const Governance = artifacts.require('Governance');
const GovernanceToken = artifacts.require('XBG');

contract('Governance', (accounts) => {

  const miris = accounts[1];
  const alice = accounts[2];
  const bob = accounts[3];

  before(async () => {
    this.governanceContract = await Governance.new();
    this.governanceToken = await GovernanceToken.new();
  });

  it('should be initialized', async () => {

  });

  describe('authority functions', () => {
    // function seize(IERC20 _token, uint256 _amount) external onlyGovernance {
    //     require(_token != stakingRewardsToken, "!stakingRewardsToken");
    //     require(_token != governanceToken, "!governanceToken");
    //     _token.safeTransfer(governance, _amount);
    // }
    describe('seize properly', () => {
      it('should transfer tokens to governance', async () => {

      });
      it('should fail if token is staking rewards token', async () => {

      });
      it('should fail if token is governance token', async () => {

      });
    });
    //
    // function setBreaker(bool _breaker) external onlyGovernance {
    //     breaker = _breaker;
    // }
    it('should set a new breaker', async () => {

    });

    // function setQuorum(uint256 _quorum) external onlyGovernance {
    //     quorum = _quorum;
    // }
    it('should set a new quorum', async () => {

    });

    // function setMinimum(uint256 _minimum) external onlyGovernance {
    //     minimum = _minimum;
    // }
    it('should set a new minumum tokens for proposing', async () => {

    });

    // function setPeriod(uint256 _period) external onlyGovernance {
    //     period = _period;
    // }
    it('should set a new default period', async () => {

    });

    // function setLock(uint256 _lock) external onlyGovernance {
    //     lock = _lock;
    // }
    it('should set a new lock', async () => {

    });
  });

  describe('governance process', () => {
    describe('proposing', () => {
      // function propose(address _executor, string memory _hash) public {
      //     require(votesOf(_msgSender()) > minimum, "<minimum");
      //     proposals[proposalCount++] = Proposal({
      //         id: proposalCount,
      //         proposer: _msgSender(),
      //         totalForVotes: 0,
      //         totalAgainstVotes: 0,
      //         start: block.number,
      //         end: period.add(block.number),
      //         executor: _executor,
      //         hash: _hash,
      //         totalVotesAvailable: totalVotes,
      //         quorum: 0,
      //         quorumRequired: quorum,
      //         open: true
      //     });
      //     emit NewProposal(
      //         proposalCount,
      //         _msgSender(),
      //         block.number,
      //         period,
      //         _executor
      //     );
      //     voteLock[_msgSender()] = lock.add(block.number);
      // }

      it('should propose a new proposal', async () => {

      });

      // synonimus: countVotes
      // function tallyVotes(uint256 _id) public {
      //     require(proposals[_id].open == true, "!open");
      //     require(proposals[_id].end < block.number, "!end");
      //
      //     (uint256 _for, uint256 _against,) = getStats(_id);
      //     bool _quorum = false;
      //     if (proposals[_id].quorum >= proposals[_id].quorumRequired) {
      //         _quorum = true;
      //     }
      //     proposals[_id].open = false;
      //     emit ProposalFinished(_id, _for, _against, _quorum);
      // }

      it('should tally votes for a proposal', async () => {

      });
    });

    describe('voter participation', () => {
      // function register() public {
      //     require(voters[_msgSender()] == false, "voter");
      //     voters[_msgSender()] = true;
      //     votes[_msgSender()] = balanceOf(_msgSender());
      //     totalVotes = totalVotes.add(votes[_msgSender()]);
      //     emit RegisterVoter(_msgSender(), votes[_msgSender()], totalVotes);
      // }
      it('should register a new voter', async () => {

      });

      // function exit() external {
      //     withdraw(balanceOf(_msgSender()));
      //     // getReward(); Un-comment this to enable the rewards.
      // }

      it('should exit from voting process', async () => {

      });

      //
      // function revoke() public {
      //     require(voters[_msgSender()] == true, "!voter");
      //     voters[_msgSender()] = false;
      //     if (totalVotes < votes[_msgSender()]) {
      //         //edge case, should be impossible, but this is defi
      //         totalVotes = 0;
      //     } else {
      //         totalVotes = totalVotes.sub(votes[_msgSender()]);
      //     }
      //     emit RevokeVoter(_msgSender(), votes[_msgSender()], totalVotes);
      //     votes[_msgSender()] = 0;
      // }

      it('should revoke the voter tokens', async () => {

      });

      // function votesOf(address _voter) public view returns(uint256) {
      //     return votes[_voter];
      // }
      it('should get the rank of the voter (governance tokens amount)', async () => {

      });
    });

    describe('voting', () => {
      // function voteFor(uint256 _id) public {
      //     require(proposals[_id].start < block.number , "<start");
      //     require(proposals[_id].end > block.number , ">end");
      //
      //     uint256 _against = proposals[_id].againstVotes[_msgSender()];
      //     if (_against > 0) {
      //         proposals[_id].totalAgainstVotes = proposals[_id].totalAgainstVotes.sub(_against);
      //         proposals[_id].againstVotes[_msgSender()] = 0;
      //     }
      //
      //     uint256 vote = votesOf(_msgSender()).sub(proposals[_id].forVotes[_msgSender()]);
      //     proposals[_id].totalForVotes = proposals[_id].totalForVotes.add(vote);
      //     proposals[_id].forVotes[_msgSender()] = votesOf(_msgSender());
      //
      //     proposals[_id].totalVotesAvailable = totalVotes;
      //     uint256 _votes = proposals[_id].totalForVotes.add(proposals[_id].totalAgainstVotes);
      //     proposals[_id].quorum = _votes.mul(10000).div(totalVotes);
      //
      //     voteLock[_msgSender()] = lock.add(block.number);
      //
      //     emit Vote(_id, _msgSender(), true, vote);
      // }
      it('should vote for', async () => {

      });
      //
      // function voteAgainst(uint256 _id) public {
      //     require(proposals[_id].start < block.number , "<start");
      //     require(proposals[_id].end > block.number , ">end");
      //
      //     uint256 _for = proposals[_id].forVotes[_msgSender()];
      //     if (_for > 0) {
      //         proposals[_id].totalForVotes = proposals[_id].totalForVotes.sub(_for);
      //         proposals[_id].forVotes[_msgSender()] = 0;
      //     }
      //
      //     uint256 vote = votesOf(_msgSender()).sub(proposals[_id].againstVotes[_msgSender()]);
      //     proposals[_id].totalAgainstVotes = proposals[_id].totalAgainstVotes.add(vote);
      //     proposals[_id].againstVotes[_msgSender()] = votesOf(_msgSender());
      //
      //     proposals[_id].totalVotesAvailable = totalVotes;
      //     uint256 _votes = proposals[_id].totalForVotes.add(proposals[_id].totalAgainstVotes);
      //     proposals[_id].quorum = _votes.mul(10000).div(totalVotes);
      //
      //     voteLock[_msgSender()] = lock.add(block.number);
      //
      //     emit Vote(_id, _msgSender(), false, vote);
      // }

      it('should vote against', async () => {

      });
    });

  });

  describe('rewards distribution', () => {
      // TODO: This will be the module for testing that the rewards are given to the stakers.
      // function lastTimeRewardApplicable() public view returns (uint256) {
      //     return Math.min(block.timestamp, periodFinish);
      // }
      it('should get last time reward applicable', async () => {

      });

      // function rewardPerToken() public view returns (uint256) {
      //     if (totalSupply() == 0) {
      //         return rewardPerTokenStored;
      //     }
      //     return
      //         rewardPerTokenStored.add(
      //             lastTimeRewardApplicable()
      //                 .sub(lastUpdateTime)
      //                 .mul(rewardRate)
      //                 .mul(1e18)
      //                 .div(totalSupply())
      //         );
      // }
      it('should get reward per token', async () => {

      });

      // function earned(address _account) public view returns (uint256) {
      //     return
      //         balanceOf(_account)
      //             .mul(rewardPerToken().sub(userRewardPerTokenPaid[_account]))
      //             .div(1e18)
      //             .add(rewards[_account]);
      // }

      it('should get count of earned staking reward tokens', async () => {

      });
      //
      // function stake(uint256 _amount) public override updateReward(_msgSender()) {
      //     require(_amount > 0, "!stake 0");
      //     if (voters[_msgSender()] == true) {
      //         votes[_msgSender()] = votes[_msgSender()].add(_amount);
      //         totalVotes = totalVotes.add(_amount);
      //     }
      //     super.stake(_amount);
      //     emit Staked(_msgSender(), _amount);
      // }

      it('should stake governance tokens', async () => {

      });
      //
      // function withdraw(uint256 _amount) public override updateReward(_msgSender()) {
      //     require(_amount > 0, "!withdraw 0");
      //     if (voters[_msgSender()] == true) {
      //         votes[_msgSender()] = votes[_msgSender()].sub(_amount);
      //         totalVotes = totalVotes.sub(_amount);
      //     }
      //     if (breaker == false) {
      //         require(voteLock[_msgSender()] < block.number,"!locked");
      //     }
      //     super.withdraw(_amount);
      //     emit Withdrawn(_msgSender(), _amount);
      // }
      it('should withdraw governance tokens', async () => {

      });
      //
      // function getReward() public updateReward(_msgSender()) {
      //     if (breaker == false) {
      //         require(voteLock[_msgSender()] > block.number,"!voted");
      //     }
      //     uint256 reward = earned(_msgSender());
      //     if (reward > 0) {
      //         rewards[_msgSender()] = 0;
      //         stakingRewardsToken.safeTransfer(_msgSender(), reward);
      //         emit RewardPaid(_msgSender(), reward);
      //     }
      // }
      it('should transfer reward amounts to caller', async () => {

      });
      // function notifyRewardAmount(uint256 _reward)
      //     external
      //     onlyRewardDistribution
      //     override
      //     updateReward(address(0))
      // {
      //     IERC20(stakingRewardsToken).safeTransferFrom(_msgSender(), address(this), _reward);
      //     if (block.timestamp >= periodFinish) {
      //         rewardRate = _reward.div(DURATION);
      //     } else {
      //         uint256 remaining = periodFinish.sub(block.timestamp);
      //         uint256 leftover = remaining.mul(rewardRate);
      //         rewardRate = _reward.add(leftover).div(DURATION);
      //     }
      //     lastUpdateTime = block.timestamp;
      //     periodFinish = block.timestamp.add(DURATION);
      //     emit RewardAdded(_reward);
      // }
      it('should transfer reward amounts to reward distributor', async () => {

      });
  });

});
