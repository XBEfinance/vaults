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

const ZERO = new BN(0);

const Governance = artifacts.require('Governance');
const GovernanceToken = artifacts.require('XBG');
const MockToken = artifacts.require('MockToken');

const toCamelCase = (str) => {
  return str.replace(
    /\W+(.)/g,
    (match, chr) => {
      return chr.toUpperCase();
    }
  );
}

const setterTest = (contractInstance, setterName, validValue, validAddress, invalidAddress) => {
  const fieldName = toCamelCase(setterName.substring(2));
  describe(`${fieldName} setter`, () => {
    it(`should set a new ${fieldName}`, async () => {
      await contractInstance[setterName](validValue, {from: validAddress});
      expect(await contractInstance[fieldName]()).to.be.equal(validValue);
    });
    it('should fail if it is to be changed not by valid address', async () => {
      await expectRevert(contractInstance[setterName](validValue, {from: invalidAddress}),
        `Setter ${setterName} test: the sender is not valid!`);
    });
  });
};

contract('Governance', (accounts) => {

  const governance = accounts[0];
  const miris = accounts[1];
  const alice = accounts[2];
  const bob = accounts[3];
  const fool = accounts[4];
  const charlie = accounts[5];

  const stardId = ZERO;
  const stakingRewardsTokenAddress = ZERO_ADDRESS;
  const initialTotalSupply = ether('15000');

  beforeEach(async () => {
    this.governanceContract = await Governance.new();
    this.governanceToken = await GovernanceToken.new(initialTotalSupply);
    await this.governanceContract.configure(
      stardId,
      stakingRewardsTokenAddress,
      governance,
      governanceToken.address
    );
  });

  it('should be configured', async () => {
    expect(await this.governanceContract.proposalCount()).to.be.bignumber.equal(stardId);
    expect(await this.governanceContract.governance()).to.be.equal(governance);
    expect(await this.governanceContract.stakingRewardsToken()).to.be.equal(stakingRewardsTokenAddress);
    expect(await this.governanceContract.governanceToken()).to.be.equal(governanceToken.address);
  });

  describe('authority functions', () => {

    const mockTokens = ether('10');
    const breakerValid = true;
    const quorumValid = new BN(200);
    const minimumValid = new BN(1000);
    const periodValid = new BN(3000);
    const lockValid = new BN(10000);

    describe('seize properly', () => {

      beforeEach(async () => {
        this.mockToken = await MockToken.new('Mock Token', 'MT', mockTokens, {from: fool});
        await this.mockToken.approve(this.governanceContract.address, mockTokens, {from: fool});
        await this.mockToken.safeTransfer(this.governanceContract.address, mockTokens, {from: fool});
      });

      it('should transfer tokens to governance', async () => {
        await this.governanceContract.seize(this.mockToken.address, mockTokens, {from: governance});
        expect(await mockToken.balanceOf(governance, {from: governance})).to.be.bignumber.equal(mockTokens);
      });

      it('should fail if token is staking rewards token', async () => {
        await expectRevert(this.governanceContract.seize(stakingRewardsTokenAddress, mockTokens, {from: governance}),
          "Governance: the token is staking rewards token!");
      });

      it('should fail if token is governance token', async () => {
        await expectRevert(this.governanceContract.seize(this.governanceToken.address, mockTokens, {from: governance}),
          "Governance: the token is governance token!");
      });

      it('should fail if caller is not governance', async () => {
        await expectRevert(this.governanceContract.seize(this.mockToken.address, mockTokens, {from: fool}),
          "Governance: a caller is not the governance address!");
      });
    });

    setterTest(
      this.governanceContract,
      'setBreaker',
      breakerValid,
      governance,
      fool
    );

    setterTest(
      this.governanceContract,
      'setQuorum',
      quorumValid,
      governance,
      fool
    );

    setterTest(
      this.governanceContract,
      'setMinimum',
      minimumValid,
      governance,
      fool
    );

    setterTest(
      this.governanceContract,
      'setPeriod',
      periodValid,
      governance,
      fool
    );

    setterTest(
      this.governanceContract,
      'setLock',
      lockValid,
      governance,
      fool
    );
  });

  describe('governance process', () => {

    const foolSum = ether('50');
    const mirisSum = ether('100');
    const aliceSum = ether('200');
    const bobSum = ether('300');
    const governanceSum = ether('500');

    const minimumSum = ether('100');
    const proposalHash = 'some proposal hash';

    before(async () => {
      // send some gov token to participate
      await this.governanceToken.approve(fool, foolSum, {from: governance});
      await this.governanceToken.approve(miris, mirisSum, {from: governance});
      await this.governanceToken.approve(alice, aliceSum, {from: governance});
      await this.governanceToken.approve(bob, bobSum, {from: governance});

      await this.governanceToken.safeTransfer(fool, foolSum, {from: governance});
      await this.governanceToken.safeTransfer(miris, mirisSum, {from: governance});
      await this.governanceToken.safeTransfer(alice, aliceSum, {from: governance});
      await this.governanceToken.safeTransfer(bob, bobSum, {from: governance});

      await this.governanceToken.safeTransfer(foolSum, {from: fool});
      await this.governanceToken.safeTransfer(mirisSum, {from: miris});
      await this.governanceToken.safeTransfer(aliceSum, {from: alice});
      await this.governanceToken.safeTransfer(bobSum, {from: bob});

      await this.governanceContract.setMinimum(mirisSum, {from: governance});
      await this.governanceContract.setQuorum(2, {from: governance});

      await this.governanceContract.register({from: fool});
      await this.governanceContract.register({from: miris});
      await this.governanceContract.register({from: alice});
      await this.governanceContract.register({from: bob});
    });

    describe('proposing', () => {

      it('should propose a new proposal', async () => {
        const oldProposalCount = await this.governanceContract.proposalCount({from: governance});
        const period = await this.governanceContract.period({from: governance});
        const lock = await this.governanceContract.lock({from: governance});
        const receipt = await this.governanceContract.propose(alice, proposalHash, {from: miris});
        const latestBlock = await time.latestBlock();
        //event NewProposal(uint256 _id, address _creator, uint256 _start, uint256 _duration, address _executor);
        expectEvent(receipt, 'NewProposal', {
          _id: oldProposalCount + 1,
          _creator: miris,
          _start: latestBlock,
          _duration: period,
          _executor: alice
        });
        expect(await this.governanceContract.voteLock(miris)).to.be.bignumber.equal(lock.add(latestBlock));
      });

      it('should fail proposal if minimal vote rank has not reached', async () => {
        await expectRevert(this.governanceContract.propose(alice, proposalHash, {from: fool}),
          'Governance: the minimum rank of the voter has not reached!');
      });

      it('should tally votes for a proposal without quorum', async () => {
        const oldProposalCount = await this.governanceContract.proposalCount({from: governance});
        const receipt = await this.governanceContract.tallyVotes(oldProposalCount, {from: miris});
        expectEvent(receipt, 'ProposalFinished', {
          _id: oldProposalCount,
          _for: ZERO,
          _against: ZERO,
          _quorumReached: false
        });
        expect(await this.governanceContract.proposals(oldProposalCount).open).to.be.equal(false);
      });

    });

    describe('voter participation', () => {

      var stakeReceipt;
      var registerReceipt;

      before(async () => {
        stakeReceipt = await this.governanceContract.stake(governanceSum, {from: governance});
        registerReceipt = await this.governanceContract.register({from: governance});
      });

      it('should get the rank of the voter (governance tokens amount)', async () => {
        expect(await this.governanceContract.votesOf(fool, {from: fool})).to.be.bignumber.equal(foolSum);
      });

      it('should register a new voter', async () => {
        const totalVotes = await this.governanceContract.totalVotes({from: governance});
        // RegisterVoter(address _voter, uint256 _votes, uint256 _totalVotes);
        expectEvent(registerReceipt, 'RegisterVoter', {
          _voter: governance,
          _votes: governanceSum,
          _totalVotes: governanceSum.add(totalVotes)
        });
        // event Staked(address indexed _user, uint256 _amount);
        expectEvent(stakeReceipt, 'Staked', {
          _user: governance,
          _amount: governanceSum
        });
      });

      it('should fail if register voter twice', async () => {
        await expectRevert(this.governanceContract.register({from: fool}),
          'Governance: a voter cannot be registered twice.');
      });

      it('should exit from voting process', async () => {
        const oldBalance = await this.governanceToken.balanceOf(governance, {from: governance});
        await this.governanceContract.exit({from: governance});
        const newBalance = await this.governanceToken.balanceOf(governance, {from: governance});
        expect(newBalance.sub(oldBalance)).to.be.bignumber.equal(governanceSum);
      });

      it('should revoke the voter tokens', async () => {
        const receipt = await this.governanceContract.revoke({from: fool});
        const totalVotes = await this.governanceContract.totalVotes({from: governance});
        // RevokeVoter(address _voter, uint256 _votes, uint256 _totalVotes);
        expectEvent(receipt, 'RevokeVoter', {
          _voter: fool,
          _votes: foolSum,
          _totalVotes: totalVotes.sub(foolSum)
        });
        expect(await this.governanceContract.voters(fool, {from: governance})).to.be.equal(false);
        expect(await this.governanceContract.votes(fool, {from: governance})).to.be.bignumber.equal(ZERO);
      });

      it('should not revoke not the voter', async () => {
        await expectRevert(this.governanceContract.revoke({from: charlie}),
          'Governance: cannot revoke not a voter.');
      });

    });

    describe('voting', () => {

      before(async () => {
        // create proposals
      });

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

      it('should not vote against when time has passed', async () => {

      });

      it('should not vote for when time has passed', async () => {

      });

    });

  });

  describe('rewards distribution', () => {
      // TODO: This will be the module for testing that the rewards are given to the stakers.
      // function lastTimeRewardApplicable() public view returns (uint256) {
      //     return Math.min(block.timestamp, periodFinish);
      // }
      it('should get last time reward applicable', async () => {
        assert.fail('NOT IMPLEMENTED');
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
        assert.fail('NOT IMPLEMENTED');
      });

      // function earned(address _account) public view returns (uint256) {
      //     return
      //         balanceOf(_account)
      //             .mul(rewardPerToken().sub(userRewardPerTokenPaid[_account]))
      //             .div(1e18)
      //             .add(rewards[_account]);
      // }

      it('should get count of earned staking reward tokens', async () => {
        assert.fail('NOT IMPLEMENTED');
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
        assert.fail('NOT IMPLEMENTED');
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
        assert.fail('NOT IMPLEMENTED');
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
        assert.fail('NOT IMPLEMENTED');
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
        assert.fail('NOT IMPLEMENTED');
      });
  });

});
