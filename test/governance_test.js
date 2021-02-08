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

const MockContract = artifacts.require("MockContract");

const MockToken = artifacts.require('MockToken');
const ExecutorMock = artifacts.require('ExecutorMock');

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

  const CONVERSION_WEI_CONSTANT = ether('1');

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
  const charlieSum = ether('120');
  const governanceSum = ether('500');

  const minumumForVoting = ether('100');
  const quorumForVoting = new BN('2');
  const proposalHash = 'some proposal hash';
  const periodForVoting = new BN('3');
  const waitingDuration = time.duration.hours(7);

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

  describe('re-deploy each unit test', () => {
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
      await governanceToken.approve(charlie, charlieSum, {from: governance});
      await governanceToken.approve(governanceContract.address, governanceSum, {from: governance});

      await governanceToken.transfer(fool, foolSum, {from: governance});
      await governanceToken.transfer(miris, mirisSum, {from: governance});
      await governanceToken.transfer(alice, aliceSum, {from: governance});
      await governanceToken.transfer(bob, bobSum, {from: governance});
      await governanceToken.transfer(charlie, charlieSum, {from: governance});

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
    //
    // it('should be configured', async () => {
    //   expect(await governanceContract.proposalCount()).to.be.bignumber.equal(stardId);
    //   expect(await governanceContract.governance()).to.be.equal(governance);
    //   expect(await governanceContract.stakingRewardsToken()).to.be.equal(stakingRewardsTokenAddress);
    //   expect(await governanceContract.governanceToken()).to.be.equal(governanceToken.address);
    // });
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
    //
    // it('should tally votes for a proposal', async () => {
    //   await governanceContract.setPeriod(periodForVoting, {from: governance});
    //   var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //   await governanceContract.propose(alice, proposalHash, {from: alice});
    //   await governanceContract.voteFor(oldProposalCount, {from: alice});
    //   await governanceContract.voteAgainst(oldProposalCount, {from: bob});
    //   await time.increase(time.duration.hours(9));
    //   const receipt = await governanceContract.tallyVotes(oldProposalCount, {from: bob});
    //   expectEvent(receipt, 'ProposalFinished', {
    //     _id: oldProposalCount,
    //     _for: new BN('4000'), // for value from getStats() - 40%
    //     _against: new BN('6000'), // against value from getStats() - 60%
    //     _quorumReached: true
    //   });
    //   expect((await governanceContract.proposals(oldProposalCount)).open).to.be.equal(false);
    // });
    //
    // describe('executor tests', () => {
    //
    //   var executorMock;
    //
    //   beforeEach(async () => {
    //     await governanceContract.setPeriod(periodForVoting, {from: governance});
    //     await governanceContract.setQuorum(quorumForVoting, {from: governance});
    //     executorMock = await ExecutorMock.new();
    //   });
    //
    //   it('should execute an executor function if quorum reached', async () => {
    //     await governanceContract.setPeriod(periodForVoting, {from: governance});
    //     const oldProposalCount = await governanceContract.proposalCount({from: governance});
    //     await governanceContract.propose(executorMock.address, proposalHash, {from: alice});
    //     await governanceContract.voteFor(oldProposalCount, {from: alice});
    //     await governanceContract.voteAgainst(oldProposalCount, {from: bob});
    //     await time.increase(time.duration.hours(9));
    //     const receipt = await governanceContract.execute(oldProposalCount, {from: governance});
    //     const aliceProcentsFor = new BN('4000');
    //     const bobProcentsAgainst = new BN('6000');
    //     expectEvent(receipt, 'ProposalFinished', {
    //       _id: oldProposalCount,
    //       _for: aliceProcentsFor, // for value from getStats() - 40%
    //       _against: bobProcentsAgainst, // against value from getStats() - 60%
    //       _quorumReached: true
    //     });
    //   });
    //
    //   it('should not execute an executor function if quorum not reached', async () => {
    //     var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //     await governanceContract.propose(alice, proposalHash, {from: alice});
    //     await expectRevert(governanceContract.execute(oldProposalCount, {from: governance}),
    //       '!quorum');
    //   });
    //
    //   it('should not execute an executor function if proposal not ended', async () => {
    //     var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //     await governanceContract.propose(alice, proposalHash, {from: alice});
    //     await governanceContract.voteFor(oldProposalCount, {from: alice});
    //     await governanceContract.voteAgainst(oldProposalCount, {from: bob});
    //     await expectRevert(governanceContract.execute(oldProposalCount, {from: governance}),
    //       '!end');
    //   });
    // });
    //
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
    // it('should vote for', async () => {
    //   await governanceContract.setPeriod(periodForVoting, {from: governance});
    //   var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //   await governanceContract.propose(alice, proposalHash, {from: alice});
    //   const receipt = await governanceContract.voteFor(oldProposalCount, {from: alice});
    //   expectEvent(receipt, 'Vote', {
    //     _id: oldProposalCount,
    //     _voter: alice,
    //     _vote: true,
    //     _weight: new BN('200000000000000000000')
    //   });
    // });
    //
    // it('should vote against', async () => {
    //   await governanceContract.setPeriod(periodForVoting, {from: governance});
    //   var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //   await governanceContract.propose(alice, proposalHash, {from: alice});
    //   const receipt = await governanceContract.voteAgainst(oldProposalCount, {from: alice});
    //   expectEvent(receipt, 'Vote', {
    //     _id: oldProposalCount,
    //     _voter: alice,
    //     _vote: false,
    //     _weight: new BN('200000000000000000000')
    //   });
    // });
    //
    // it('should not vote against when time has passed', async () => {
    //   await governanceContract.setPeriod(periodForVoting, {from: governance});
    //   var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //   await governanceContract.propose(alice, proposalHash, {from: alice});
    //   await time.increase(time.duration.days(1));
    //   await time.advanceBlock();
    //   await time.advanceBlock();
    //   await time.advanceBlock();
    //   await time.advanceBlock();
    //   await expectRevert(governanceContract.voteAgainst(oldProposalCount, {from: alice}), '>end');
    // });
    //
    // it('should not vote for when time has passed', async () => {
    //   await governanceContract.setPeriod(periodForVoting, {from: governance});
    //   var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //   await governanceContract.propose(alice, proposalHash, {from: alice});
    //   await time.increase(time.duration.days(1));
    //   await time.advanceBlock();
    //   await time.advanceBlock();
    //   await time.advanceBlock();
    //   await time.advanceBlock();
    //   await expectRevert(governanceContract.voteFor(oldProposalCount, {from: alice}), '>end');
    // });
    //
    // it('should exit vote process successfully', async () => {
    //   const oldBalance = await governanceToken.balanceOf(fool, {from: fool});
    //   await governanceContract.exit({from: fool});
    //   const newBalance = await governanceToken.balanceOf(fool, {from: fool});
    //   expect(newBalance.sub(oldBalance)).to.be.bignumber.equal(foolSum);
    // });
    //
    // it('should get stats of the votes', async () => {
    //   var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //   await governanceContract.propose(alice, proposalHash, {from: alice});
    //   await governanceContract.voteFor(oldProposalCount, {from: alice});
    //   await governanceContract.voteAgainst(oldProposalCount, {from: bob});
    //   var { _for, _against, _quorum } = await governanceContract.getStats(
    //     oldProposalCount,
    //     {from: governance}
    //   );
    //   expect(_for).to.be.bignumber.equal(new BN('4000'));
    //   expect(_against).to.be.bignumber.equal(new BN('6000'));
    //   expect(_quorum).to.be.bignumber.equal(new BN('4166'));
    // });
    //
    // it('should get last time reward applicable', async () => {
    //   const periodFinish = await governanceContract.periodFinish({from: governance});
    //   const lastTimeRewardApplicable = await governanceContract.lastTimeRewardApplicable({from: governance});
    //   expect(lastTimeRewardApplicable).to.be.bignumber.equal(periodFinish);
    // });

    // it('should fail to stake governance tokens if zero provided', async () => {
    //   await expectRevert(governanceContract.stake(ZERO, {from: fool}), '!stake 0');
    // });

    // it('should stake governance tokens if sender is not a voter', async () => {
    //   await governanceToken.approve(governanceContract.address, charlieSum, {from: charlie});
    //   const receipt = await governanceContract.stake(charlieSum, {from: charlie});
    //   expectEvent(receipt, 'Staked', {
    //     _user: charlie,
    //     _amount: charlieSum
    //   });
    // });
    //
    // it('should stake governance tokens and add votes if sender is voter', async () => {
    //   await governanceToken.approve(bob, charlieSum, {from: governance});
    //   await governanceToken.transfer(bob, charlieSum, {from: governance});
    //   await governanceToken.approve(governanceContract.address, charlieSum, {from: bob});
    //   const oldTotalVotes = await governanceContract.totalVotes({from: governance});
    //   const receipt = await governanceContract.stake(charlieSum, {from: bob});
    //   expectEvent(receipt, 'Staked', {
    //     _user: bob,
    //     _amount: charlieSum
    //   });
    //   expect(await governanceContract.totalVotes({from: governance})).to.be.bignumber.equal(oldTotalVotes.add(charlieSum));
    // });

    // it('should withdraw governance tokens', async () => {
    //   await governanceContract.setBreaker(true, {from: governance});
    //   await governanceToken.approve(bob, charlieSum, {from: governance});
    //   await governanceToken.transfer(bob, charlieSum, {from: governance});
    //   await governanceToken.approve(governanceContract.address, charlieSum, {from: bob});
    //   const oldBalance = await governanceToken.balanceOf(bob, {from: bob});
    //   await governanceContract.stake(charlieSum, {from: bob});
    //   const oldTotalVotes = await governanceContract.totalVotes({from: governance});
    //   const receipt = await governanceContract.withdraw(charlieSum, {from: bob});
    //   // event Withdrawn(address indexed _user, uint256 _amount);
    //   expectEvent(receipt, 'Withdrawn', {
    //     _user: bob,
    //     _amount: charlieSum
    //   });
    //   expect(await governanceContract.totalVotes({from: governance})).to.be.bignumber.equal(oldTotalVotes.sub(charlieSum));
    // });

    // it('should not withdraw governance tokens if zero provided', async () => {
    //   await expectRevert(governanceContract.withdraw(ZERO, {from: fool}), '!withdraw 0');
    // });

    // it('should fail if vote locked', async () => {
    //   await governanceToken.approve(bob, charlieSum, {from: governance});
    //   await governanceToken.transfer(bob, charlieSum, {from: governance});
    //   await governanceToken.approve(governanceContract.address, charlieSum, {from: bob});
    //   await governanceContract.stake(charlieSum, {from: bob});
    //   await governanceContract.setPeriod(periodForVoting, {from: governance});
    //   var oldProposalCount = await governanceContract.proposalCount({from: governance});
    //   await governanceContract.propose(alice, proposalHash, {from: alice});
    //   await governanceContract.voteAgainst(oldProposalCount, {from: bob});
    //   await expectRevert(governanceContract.withdraw(charlieSum, {from: bob}), '!locked');
    // });

    it('should not transfer reward amounts to caller if locked', async () => {
        await expectRevert(governanceContract.getReward({from: bob}), '!voted');
    });


  });


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
    const mock = await MockContract.new();
    const governanceContract = await Governance.at(mock.address);
    const mockedGovernanceToken = await GovernanceToken.new(initialTotalSupply, {from: governance});
    await governanceContract.configure(
      stardId,
      stakingRewardsTokenAddress,
      governance,
      mockedGovernanceToken.address
    );
    await governanceToken.approve(bob, charlieSum, {from: governance});
    await governanceToken.transfer(bob, charlieSum, {from: governance});
    await governanceToken.approve(governanceContract.address, charlieSum, {from: bob});
    await governanceContract.stake(charlieSum, {from: bob});
    await governanceContract.setPeriod(periodForVoting, {from: governance});
    var oldProposalCount = await governanceContract.proposalCount({from: governance});
    await governanceContract.propose(alice, proposalHash, {from: alice});
    await governanceContract.voteAgainst(oldProposalCount, {from: bob});

    //TODO: add mock to earned and do get reward

    const reward = await governanceContract.earned(bob, {from: bob});
    const receipt = await governanceContract.getReward({from: bob});
    // event RewardPaid(address indexed _user, uint256 _reward);
    expectEvent(receipt, 'RewardPaid', {
      _user: bob,
      _reward: reward
    });
  });

  // it('should get reward per token', async () => {
  //
  //   var governanceToken = await GovernanceToken.new(0, {from: governance});
  //   var governanceContract = await Governance.new();
  //   await governanceContract.configure(
  //     stardId,
  //     stakingRewardsTokenAddress,
  //     governance,
  //     governanceToken.address
  //   );
  //
  //   var rewardPerToken = await governanceContract.rewardPerToken({from: governance});
  //   var rewardPerTokenStored = await governanceContract.rewardPerTokenStored({from: governance});
  //   expect(rewardPerToken).to.be.bignumber.equal(rewardPerTokenStored);
  //
  //   governanceToken = await GovernanceToken.new(initialTotalSupply, {from: governance});
  //   governanceContract = await Governance.new();
  //   await governanceContract.configure(
  //     stardId,
  //     stakingRewardsTokenAddress,
  //     governance,
  //     governanceToken.address
  //   );
  //
  //   rewardPerTokenStored = await governanceContract.rewardPerTokenStored({from: governance});
  //   const lastTimeRewardApplicable = await governanceContract.lastTimeRewardApplicable({from: governance});
  //   const lastUpdateTime = await governanceContract.lastUpdateTime({from: governance});
  //   const rewardRate = await governanceContract.rewardRate({from: governance});
  //   const totalSupply = await governanceContract.totalSupply({from: governance});
  //
  //   console.log(rewardPerTokenStored.toString(),
  //     lastTimeRewardApplicable.toString(),
  //     lastUpdateTime.toString(),
  //     rewardRate.toString(),
  //     totalSupply.toString());
  //
  //   rewardPerToken = await governanceContract.rewardPerToken({from: governance});
  //
  //   const trueRewardPerToken = rewardPerTokenStored.add(
  //     lastTimeRewardApplicable
  //       .sub(lastUpdateTime)
  //       .mul(rewardRate)
  //       .mul(CONVERSION_WEI_CONSTANT)
  //       .div(totalSupply)
  //   );
  //   console.log(rewardPerToken, trueRewardPerToken);
  //   expect(rewardPerToken).to.be.bignumber.equal(trueRewardPerToken);
  // });
  //
  // it('should get count of earned staking reward tokens', async () => {
  //     const mock = await MockContract.new();
  //     const governanceContract = await Governance.new();
  //     const mockedGovernanceToken = await GovernanceToken.at(mock.address);
  //     await governanceContract.configure(
  //       stardId,
  //       stakingRewardsTokenAddress,
  //       governance,
  //       mockedGovernanceToken.address
  //     );
  //
  //     const balanceOfAccountABI = governanceContract.contract.methods.balanceOf(ZERO_ADDRESS).encodeABI();
  //     const rewardPerTokenABI = governanceContract.contract.methods.rewardPerToken().encodeABI();
  //     const userRewardPerTokenPaidABI = governanceContract.contract.methods.userRewardPerTokenPaid(ZERO_ADDRESS).encodeABI();
  //     const rewardsABI = governanceContract.contract.methods.rewards(ZERO_ADDRESS).encodeABI();
  //
  //     await mock.givenMethodReturnUint(balanceOfAccountABI, ether('5'));
  //
  //     const balanceOfAccount = await governanceContract.balanceOf(governance, {from: governance});
  //     const rewardPerToken = await governanceContract.rewardPerToken({from: governance});
  //     const userRewardPerTokenPaid = await governanceContract.userRewardPerTokenPaid(governance, {from: governance});
  //     const rewards = await governanceContract.rewards(governance, {from: governance});
  //
  //     const earned = await governanceContract.earned(governance, {from: governance});
  //
  //     const trueEarned = balanceOfAccount
  //         .mul(rewardPerToken.sub(userRewardPerTokenPaid))
  //         .div(CONVERSION_WEI_CONSTANT)
  //         .add(rewards);
  //
  //     console.log(
  //       `balance of governance: ${balanceOfAccount}`,
  //       `reward per token: ${rewardPerToken}`,
  //       `user reward per token paid: ${userRewardPerTokenPaid}`,
  //       `rewards: ${rewards}`,
  //       `true earned: ${trueEarned}`,
  //       `const: ${CONVERSION_WEI_CONSTANT}`,
  //       `earned: ${earned}`
  //     );
  //     expect(earned).to.be.bignumber.equal(trueEarned);
  // });



  //
  // // function notifyRewardAmount(uint256 _reward)
  // //     external
  // //     onlyRewardDistribution
  // //     override
  // //     updateReward(address(0))
  // // {
  // //     IERC20(stakingRewardsToken).safeTransferFrom(_msgSender(), address(this), _reward);
  // //     if (block.timestamp >= periodFinish) {
  // //         rewardRate = _reward.div(DURATION);
  // //     } else {
  // //         uint256 remaining = periodFinish.sub(block.timestamp);
  // //         uint256 leftover = remaining.mul(rewardRate);
  // //         rewardRate = _reward.add(leftover).div(DURATION);
  // //     }
  // //     lastUpdateTime = block.timestamp;
  // //     periodFinish = block.timestamp.add(DURATION);
  // //     emit RewardAdded(_reward);
  // // }
  // it('should transfer reward amounts to reward distributor', async () => {
  //   assert.fail('NOT IMPLEMENTED');
  // });
});
