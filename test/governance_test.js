/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const ZERO = new BN('0');

const Governance = artifacts.require('Governance');
const GovernanceToken = artifacts.require('XBG');
const MockToken = artifacts.require('MockToken');

const deployAndConfigureGovernance = async (
    stardId,
    initialTotalSupply,
    stakingRewardsTokenAddress,
    governance
) => {
  const governanceContract = await Governance.new();
  const governanceToken = await GovernanceToken.new(initialTotalSupply);
  await governanceContract.configure(
    stardId,
    stakingRewardsTokenAddress,
    governance,
    governanceToken.address
  );
  return [ governanceContract, governanceToken ];
}

const governanceSetterTest = (
    stardId,
    initialTotalSupply,
    stakingRewardsTokenAddress,
    governance,
    setterName,
    validValue,
    validAddress,
    invalidAddress,
    revertMessage,
) => {
  const rawFieldName = setterName.substring(3);
  const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
  describe(`${fieldName} setter`, () => {

    beforeEach(async () => {
      [this.governanceContract, _] = await deployAndConfigureGovernance(
        stardId,
        initialTotalSupply,
        stakingRewardsTokenAddress,
        governance
      );
    });

    it(`should set a new ${fieldName}`, async () => {
      await this.governanceContract[setterName](validValue, {from: validAddress});
      expect((await this.governanceContract[fieldName]()).toString()).to.be.equal(validValue.toString());
    });

    it('should fail if it is to be changed not by valid address', async () => {
      await expectRevert(
        this.governanceContract[setterName](validValue, {from: invalidAddress}),
        revertMessage
      );
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

  var governanceContract;
  var governanceToken;
  var registerGovernanceReceipt;
  var stakeGovernanceReceipt;

  const mockTokens = ether('10');
  const breakerValid = true;
  const quorumValid = new BN('200');
  const minimumValid = new BN('1000');
  const periodValid = new BN('3000');
  const lockValid = new BN('10000');

  const foolSum = ether('50');
  const mirisSum = ether('150');
  const aliceSum = ether('200');
  const bobSum = ether('300');
  const governanceSum = ether('500');

  const minumumForVoting = ether('100');
  const quorumForVoting = new BN('2');
  const proposalHash = 'some proposal hash';
  const periodForVoting = new BN('3');
  const waitingDuration = time.duration.hours(7);


  beforeEach(async () => {
    [ governanceContract, governanceToken ] = await deployAndConfigureGovernance(
      stardId,
      initialTotalSupply,
      stakingRewardsTokenAddress,
      governance
    );

    // send some gov token to participate
    await governanceToken.approve(fool, foolSum, {from: governance});
    await governanceToken.approve(miris, mirisSum, {from: governance});
    await governanceToken.approve(alice, aliceSum, {from: governance});
    await governanceToken.approve(bob, bobSum, {from: governance});
    await governanceToken.approve(governanceContract.address, governanceSum, {from: governance});

    await governanceToken.transfer(fool, foolSum, {from: governance});
    await governanceToken.transfer(miris, mirisSum, {from: governance});
    await governanceToken.transfer(alice, aliceSum, {from: governance});
    await governanceToken.transfer(bob, bobSum, {from: governance});

    await governanceContract.register({from: fool});
    await governanceContract.register({from: miris});
    await governanceContract.register({from: alice});
    await governanceContract.register({from: bob});
    registerGovernanceReceipt = await governanceContract.register({from: governance});

    await governanceToken.approve(governanceContract.address, foolSum, {from: fool});
    await governanceToken.approve(governanceContract.address, mirisSum, {from: miris});
    await governanceToken.approve(governanceContract.address, aliceSum, {from: alice});
    await governanceToken.approve(governanceContract.address, bobSum, {from: bob});
    await governanceToken.approve(governanceContract.address, governanceSum, {from: governance});

    await governanceContract.stake(foolSum, {from: fool});
    await governanceContract.stake(mirisSum, {from: miris});
    await governanceContract.stake(aliceSum, {from: alice});
    await governanceContract.stake(bobSum, {from: bob});
    stakeGovernanceReceipt = await governanceContract.stake(governanceSum, {from: governance});
  });

  // it('should be configured', async () => {
  //   expect(await governanceContract.proposalCount()).to.be.bignumber.equal(stardId);
  //   expect(await governanceContract.governance()).to.be.equal(governance);
  //   expect(await governanceContract.stakingRewardsToken()).to.be.equal(stakingRewardsTokenAddress);
  //   expect(await governanceContract.governanceToken()).to.be.equal(governanceToken.address);
  // });
  //
  // governanceSetterTest(
  //   stardId,
  //   initialTotalSupply,
  //   stakingRewardsTokenAddress,
  //   governance,
  //   'setBreaker',
  //   breakerValid,
  //   governance,
  //   fool,
  //   "!governance"
  // );
  //
  // governanceSetterTest(
  //   stardId,
  //   initialTotalSupply,
  //   stakingRewardsTokenAddress,
  //   governance,
  //   'setQuorum',
  //   quorumValid,
  //   governance,
  //   fool,
  //   "!governance"
  // );
  //
  // governanceSetterTest(
  //   stardId,
  //   initialTotalSupply,
  //   stakingRewardsTokenAddress,
  //   governance,
  //   'setMinimum',
  //   minimumValid,
  //   governance,
  //   fool,
  //   "!governance"
  // );
  //
  // governanceSetterTest(
  //   stardId,
  //   initialTotalSupply,
  //   stakingRewardsTokenAddress,
  //   governance,
  //   'setPeriod',
  //   periodValid,
  //   governance,
  //   fool,
  //   "!governance"
  // );
  //
  // governanceSetterTest(
  //   stardId,
  //   initialTotalSupply,
  //   stakingRewardsTokenAddress,
  //   governance,
  //   'setLock',
  //   lockValid,
  //   governance,
  //   fool,
  //   "!governance"
  // );
  //
  // describe('seize properly', () => {
  //
  //   var mockToken;
  //
  //   beforeEach(async () => {
  //     mockToken = await MockToken.new('Mock Token', 'MT', mockTokens, {from: fool});
  //     await mockToken.approve(governanceContract.address, mockTokens, {from: fool});
  //     await mockToken.transfer(governanceContract.address, mockTokens, {from: fool});
  //   });
  //
  //   it('should transfer tokens to governance', async () => {
  //     await governanceContract.seize(mockToken.address, mockTokens, {from: governance});
  //     expect(await mockToken.balanceOf(governance, {from: governance})).to.be.bignumber.equal(mockTokens);
  //   });
  //
  //   it('should fail if token is staking rewards token', async () => {
  //     await expectRevert(governanceContract.seize(stakingRewardsTokenAddress, mockTokens, {from: governance}),
  //       "!stakingRewardsToken");
  //   });
  //
  //   it('should fail if token is governance token', async () => {
  //     await expectRevert(governanceContract.seize(governanceToken.address, mockTokens, {from: governance}),
  //       "!governanceToken");
  //   });
  //
  //   it('should fail if caller is not governance', async () => {
  //     await expectRevert(governanceContract.seize(mockToken.address, mockTokens, {from: fool}),
  //       "!governance");
  //   });
  // });
  //
  // it('should get the rank of the voter (governance tokens amount)', async () => {
  //   expect(await governanceContract.votesOf(miris, {from: miris})).to.be.bignumber.equal(mirisSum);
  // });
  //
  // it('should propose a new proposal', async () => {
  //   const oldProposalCount = await governanceContract.proposalCount({from: governance});
  //   const period = await governanceContract.period({from: governance});
  //   const lock = await governanceContract.lock({from: governance});
  //   const receipt = await governanceContract.propose(alice, proposalHash, {from: miris});
  //   const latestBlock = await time.latestBlock();
  //   expectEvent(receipt, 'NewProposal', {
  //     _id: oldProposalCount,
  //     _creator: miris,
  //     _start: latestBlock,
  //     _duration: period,
  //     _executor: alice
  //   });
  //   expect(await governanceContract.voteLock(miris)).to.be.bignumber.equal(lock.add(latestBlock));
  // });
  //
  // it('should fail proposal if minimal vote rank has not reached', async () => {
  //   await governanceContract.setMinimum(minumumForVoting, {from: governance});
  //   await expectRevert(governanceContract.propose(alice, proposalHash, {from: fool}),
  //     '<minimum');
  // });

  it('should tally votes for a proposal', async () => {
    await governanceContract.setPeriod(periodForVoting, {from: governance});
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await governanceContract.propose(alice, proposalHash, {from: alice});
    await governanceContract.voteFor(oldProposalCount, {from: alice});
    await governanceContract.voteAgainst(oldProposalCount, {from: bob});
    await time.increase(waitingDuration);
    console.log(
      (await governanceContract.proposals(oldProposalCount)).end.toString(),
      (await time.latestBlock()).toString()
    );
    const receipt = await governanceContract.tallyVotes(oldProposalCount, {from: bob});
    expectEvent(receipt, 'ProposalFinished', {
      _id: oldProposalCount,
      _for: new BN('4000'), // for value from getStats() - 40%
      _against: new BN('6000'), // against value from getStats() - 60%
      _quorumReached: true
    });
    expect((await governanceContract.proposals(oldProposalCount)).open).to.be.equal(false);
  });

  // it('should register a new voter', async () => {
  //   expectEvent(registerGovernanceReceipt, 'RegisterVoter', {
  //     _voter: governance,
  //     _votes: ZERO,
  //     _totalVotes: ZERO
  //   });
  //   expectEvent(stakeGovernanceReceipt, 'Staked', {
  //     _user: governance,
  //     _amount: governanceSum
  //   });
  // });
  //
  // it('should fail if register voter twice', async () => {
  //   await expectRevert(governanceContract.register({from: fool}),
  //     'voter');
  // });
  //
  // it('should exit from voting process', async () => {
  //   const oldBalance = await governanceToken.balanceOf(governance, {from: governance});
  //   await governanceContract.exit({from: governance});
  //   const newBalance = await governanceToken.balanceOf(governance, {from: governance});
  //   expect(newBalance.sub(oldBalance)).to.be.bignumber.equal(governanceSum);
  // });
  //
  // it('should revoke the voter tokens', async () => {
  //   const totalVotes = await governanceContract.totalVotes({from: governance});
  //   const receipt = await governanceContract.revoke({from: fool});
  //   // RevokeVoter(address _voter, uint256 _votes, uint256 _totalVotes);
  //   expectEvent(receipt, 'RevokeVoter', {
  //     _voter: fool,
  //     _votes: foolSum,
  //     _totalVotes: totalVotes.sub(foolSum)
  //   });
  //   expect(await governanceContract.voters(fool, {from: governance})).to.be.equal(false);
  //   expect(await governanceContract.votes(fool, {from: governance})).to.be.bignumber.equal(ZERO);
  // });
  //
  // it('should not revoke not the voter', async () => {
  //   await expectRevert(governanceContract.revoke({from: charlie}),
  //     '!voter');
  // });
  //
  it('should vote for', async () => {
    await governanceContract.setPeriod(periodForVoting, {from: governance});
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await governanceContract.propose(alice, proposalHash, {from: alice});
    const receipt = await governanceContract.voteFor(oldProposalCount, {from: alice});
    expectEvent(receipt, 'Vote', {
      _id: oldProposalCount,
      _voter: alice,
      _vote: true,
      _weight: aliceSum.sub(await (await governanceContract.proposals(oldProposalCount)).forVotes[alice])
    });
  });

  it('should vote against', async () => {
    await governanceContract.setPeriod(periodForVoting, {from: governance});
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await governanceContract.propose(alice, proposalHash, {from: alice});
    const receipt = await governanceContract.voteAgainst(oldProposalCount, {from: alice});
    expectEvent(receipt, 'Vote', {
      _id: oldProposalCount,
      _voter: alice,
      _vote: false,
      _weight: aliceSum.sub(await (await governanceContract.proposals(oldProposalCount)).againstVotes[alice])
    });
  });

  it('should not vote against when time has passed', async () => {
    await governanceContract.setPeriod(periodForVoting, {from: governance});
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await governanceContract.propose(alice, proposalHash, {from: alice});
    await time.increase(time.duration.hours(8));
    await expectRevert(governanceContract.voteAgainst(oldProposalCount, {from: alice}), '>end');
  });

  it('should not vote for when time has passed', async () => {
    await governanceContract.setPeriod(periodForVoting, {from: governance});
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await governanceContract.propose(alice, proposalHash, {from: alice});
    await time.increase(time.duration.hours(8));
    await expectRevert(governanceContract.voteFor(oldProposalCount, {from: alice}), '>end');
  });

  it('should not vote against before start', async () => {
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await expectRevert(governanceContract.voteAgainst(oldProposalCount, {from: alice}), '<start');
  });

  it('should not vote for before start', async () => {
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await expectRevert(governanceContract.voteFor(oldProposalCount, {from: alice}), '<start');
  });

  it('should exit vote process successfully', async () => {

  });

  it('should get stats of the votes', async () => {

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
