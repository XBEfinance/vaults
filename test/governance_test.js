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

const { activeActor, actorStake, deployAndConfigureGovernance } = require(
  './utils/governance_redeploy'
);

const { ZERO, CONVERSION_WEI_CONSTANT } = require('./utils/common');

const Governance = artifacts.require('Governance');
const GovernanceToken = artifacts.require('XBG');
const MockContract = artifacts.require("MockContract");
const MockToken = artifacts.require('MockToken');
const ExecutorMock = artifacts.require('ExecutorMock');

const governanceSetterTest = (
    stardId,
    initialTotalSupply,
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
      [this.governanceContract, _, _] = await deployAndConfigureGovernance(
        stardId,
        initialTotalSupply,
        governance,
        governance,
        ether('123'),
        governance,
        ZERO,
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
  const initialTotalSupply = ether('15000');

  var governanceContract;
  var governanceToken;
  var stakingRewardsToken;

  var registerReceipt;
  var stakeReceipt;

  const mockTokens = ether('10');
  const breakerValid = true;
  const quorumValid = new BN('200');
  const minimumValid = new BN('1000');
  const periodValid = new BN('3000');
  const lockValid = new BN('10000');

  const foolSum = ether('50');
  const mirisSum = ether('101');
  const aliceSum = ether('102');
  const bobSum = ether('103');
  const charlieSum = ether('104');
  const governanceSum = ether('1000');

  const minumumForVoting = ether('100');
  const quorumForVoting = new BN('2');
  const proposalHash = 'some proposal hash';
  const periodForVoting = new BN('3');
  const waitingDuration = time.duration.hours(7);

  governanceSetterTest(
    stardId,
    initialTotalSupply,
    governance,
    'setBreaker',
    breakerValid,
    governance,
    fool,
    "!governance"
  );

  governanceSetterTest(
    stardId,
    initialTotalSupply,
    governance,
    'setQuorum',
    quorumValid,
    governance,
    fool,
    "!governance"
  );

  governanceSetterTest(
    stardId,
    initialTotalSupply,
    governance,
    'setMinimum',
    minimumValid,
    governance,
    fool,
    "!governance"
  );

  governanceSetterTest(
    stardId,
    initialTotalSupply,
    governance,
    'setPeriod',
    periodValid,
    governance,
    fool,
    "!governance"
  );

  governanceSetterTest(
    stardId,
    initialTotalSupply,
    governance,
    'setLock',
    lockValid,
    governance,
    fool,
    "!governance"
  );

  describe('re-deploy each unit test', () => {
    beforeEach(async () => {
      [ governanceContract, governanceToken, stakingRewardsToken ] = await deployAndConfigureGovernance(
        stardId,
        initialTotalSupply,
        governance,
        governance,
        ether('123'),
        governance,
        ZERO,
        governance
      );
    });

    it('should be configured', async () => {
      expect(await governanceContract.proposalCount()).to.be.bignumber.equal(stardId);
      expect(await governanceContract.governance()).to.be.equal(governance);
      expect(await governanceContract.rewardsToken()).to.be.equal(stakingRewardsToken.address);
      expect(await governanceContract.governanceToken()).to.be.equal(governanceToken.address);
      expect(await governanceContract.rewardDistribution()).to.be.equal(governance);
    });

    describe('seize properly', () => {

      var mockToken;

      beforeEach(async () => {
        mockToken = await MockToken.new('Other Mock Token', 'OMT', mockTokens, {from: fool});
        await mockToken.approve(governanceContract.address, mockTokens, {from: fool});
        await mockToken.transfer(governanceContract.address, mockTokens, {from: fool});
      });

      it('should transfer tokens to governance', async () => {
        await governanceContract.seize(mockToken.address, mockTokens, {from: governance});
        expect(await mockToken.balanceOf(governance, {from: governance})).to.be.bignumber.equal(mockTokens);
      });

      it('should fail if token is staking rewards token', async () => {
        await expectRevert(governanceContract.seize(stakingRewardsToken.address, mockTokens, {from: governance}),
          "!rewardsToken");
      });

      it('should fail if token is governance token', async () => {
        await expectRevert(governanceContract.seize(governanceToken.address, mockTokens, {from: governance}),
          "!governanceToken");
      });

      it('should fail if caller is not governance', async () => {
        await expectRevert(governanceContract.seize(mockToken.address, mockTokens, {from: fool}),
          "!governance");
      });
    });

    it('should get the rank of the voter (governance tokens amount)', async () => {
      await activeActor(miris, mirisSum, governanceContract, governanceToken, governance);
      await actorStake(miris, mirisSum, governanceContract, governanceToken);
      expect(await governanceContract.votesOf(miris, {from: miris})).to.be.bignumber.equal(mirisSum);
    });

    it('should propose a new proposal', async () => {

      await governanceContract.setMinimum(minumumForVoting, {from: governance});
      await activeActor(miris, mirisSum, governanceContract, governanceToken, governance);
      await actorStake(miris, mirisSum, governanceContract, governanceToken);

      const oldProposalCount = await governanceContract.proposalCount({from: governance});
      const period = await governanceContract.period({from: governance});
      const lock = await governanceContract.lock({from: governance});
      const receipt = await governanceContract.propose(alice, proposalHash, {from: miris});
      const latestBlock = await time.latestBlock();
      expectEvent(receipt, 'NewProposal', {
        _id: oldProposalCount,
        _creator: miris,
        _start: latestBlock,
        _duration: period,
        _executor: alice
      });
      expect(await governanceContract.voteLock(miris)).to.be.bignumber.equal(lock.add(latestBlock));
    });

    it('should fail proposal if minimal vote rank has not reached', async () => {
      await activeActor(fool, foolSum, governanceContract, governanceToken, governance);
      await governanceContract.setMinimum(minumumForVoting, {from: governance});
      await expectRevert(governanceContract.propose(alice, proposalHash, {from: fool}),
        '<minimum');
    });

    it('should tally votes for a proposal', async () => {

      await governanceContract.setMinimum(minumumForVoting, {from: governance});

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await activeActor(bob, bobSum, governanceContract, governanceToken, governance);
      await actorStake(bob, bobSum, governanceContract, governanceToken);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await governanceContract.setPeriod(periodForVoting, {from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});

      await expectRevert(governanceContract.tallyVotes(oldProposalCount), "!open");

      await governanceContract.propose(alice, proposalHash, {from: alice});
      await governanceContract.voteFor(oldProposalCount, {from: alice});
      await governanceContract.voteAgainst(oldProposalCount, {from: bob});

      await expectRevert(governanceContract.tallyVotes(oldProposalCount, {from: bob}), "!end")

      await time.increase(time.duration.hours(9));
      const receipt = await governanceContract.tallyVotes(oldProposalCount, {from: bob});
      expectEvent(receipt, 'ProposalFinished', {
        _id: oldProposalCount,
        _for: new BN('4975'), // for value from getStats() - ~40%
        _against: new BN('5024'), // against value from getStats() - ~51%
        _quorumReached: true
      });
      expect((await governanceContract.proposals(oldProposalCount)).open).to.be.equal(false);
    });

    describe('executor tests', () => {

      var executorMock;

      beforeEach(async () => {
        await governanceContract.setPeriod(periodForVoting, {from: governance});
        await governanceContract.setQuorum(quorumForVoting, {from: governance});
        executorMock = await ExecutorMock.new();
      });

      it('should execute an executor function if quorum reached', async () => {

        await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
        await actorStake(alice, aliceSum, governanceContract, governanceToken);
        await activeActor(bob, bobSum, governanceContract, governanceToken, governance);
        await actorStake(bob, bobSum, governanceContract, governanceToken);


        await governanceContract.setPeriod(periodForVoting, {from: governance});
        const oldProposalCount = await governanceContract.proposalCount({from: governance});
        await governanceContract.propose(executorMock.address, proposalHash, {from: alice});
        await governanceContract.voteFor(oldProposalCount, {from: alice});
        await governanceContract.voteAgainst(oldProposalCount, {from: bob});
        await time.increase(time.duration.hours(9));
        const receipt = await governanceContract.execute(oldProposalCount, {from: alice});
        const aliceProcentsFor = new BN('4975');
        const bobProcentsAgainst = new BN('5024');
        expectEvent(receipt, 'ProposalFinished', {
          _id: oldProposalCount,
          _for: aliceProcentsFor, // for value from getStats() - 40%
          _against: bobProcentsAgainst, // against value from getStats() - 60%
          _quorumReached: true
        });
      });

      it('should not execute an executor function if quorum not reached', async () => {

        await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
        await actorStake(alice, aliceSum, governanceContract, governanceToken);

        var oldProposalCount = await governanceContract.proposalCount({from: governance});
        await governanceContract.propose(alice, proposalHash, {from: alice});
        await expectRevert(governanceContract.execute(oldProposalCount, {from: alice}),
          '!quorum');
      });

      it('should not execute an executor function if proposal not ended', async () => {

        await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
        await actorStake(alice, aliceSum, governanceContract, governanceToken);
        await activeActor(bob, bobSum, governanceContract, governanceToken, governance);

        var oldProposalCount = await governanceContract.proposalCount({from: governance});
        await governanceContract.propose(alice, proposalHash, {from: alice});
        await governanceContract.voteFor(oldProposalCount, {from: alice});
        await governanceContract.voteAgainst(oldProposalCount, {from: bob});
        await expectRevert(governanceContract.execute(oldProposalCount, {from: governance}),
          '!end');
      });
    });

    it('should register a new voter', async () => {

      await governanceToken.approve(miris, mirisSum, {from: governance});
      await governanceToken.transfer(miris, mirisSum, {from: governance});
      const registerReceipt = await governanceContract.register({from: miris});
      await governanceToken.approve(governanceContract.address, mirisSum, {from: miris});
      const stakeReceipt = await governanceContract.stake(mirisSum, {from: miris});

      expectEvent(registerReceipt, 'RegisterVoter', {
        _voter: miris,
        _votes: ZERO,
        _totalVotes: ZERO
      });
      expectEvent(stakeReceipt, 'Staked', {
        _user: miris,
        _amount: mirisSum
      });
    });

    it('should fail if register voter twice', async () => {
      await activeActor(fool, foolSum, governanceContract, governanceToken, governance);
      await expectRevert(governanceContract.register({from: fool}),
        'voter');
    });

    it('should exit from voting process', async () => {

      await governanceContract.setPeriod(periodForVoting, {from: governance});
      await governanceContract.setMinimum(minumumForVoting, {from: governance});
      await governanceContract.setBreaker(true);

      const someRandomReward = ether('100');
      await stakingRewardsToken.approve(governanceContract.address, someRandomReward, {from: governance});
      await governanceContract.notifyRewardAmount(someRandomReward, {from: governance});

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      const oldBalance = await governanceToken.balanceOf(alice, {from: alice});
      await actorStake(alice, aliceSum.div(new BN('2')), governanceContract, governanceToken);
      await time.increase(time.duration.days(1));
      await actorStake(alice, aliceSum.div(new BN('2')), governanceContract, governanceToken);
      await time.increase(time.duration.days(1));

      await activeActor(bob, bobSum, governanceContract, governanceToken, governance);
      await actorStake(bob, bobSum, governanceContract, governanceToken);

      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      await governanceContract.voteFor(oldProposalCount, {from: alice});
      await governanceContract.voteAgainst(oldProposalCount, {from: bob});
      await time.increase(time.duration.hours(9));
      await governanceContract.tallyVotes(oldProposalCount);

      const rewardsForAlice = await governanceContract.earned(alice);

      await governanceContract.exit({from: alice});
      const newBalance = await governanceToken.balanceOf(alice, {from: alice});
      expect(oldBalance.sub(newBalance)).to.be.bignumber.equal(ZERO);
      expect(await stakingRewardsToken.balanceOf(alice)).to.be.bignumber.equal(rewardsForAlice);
    });

    it('should revoke the voter tokens', async () => {
      await activeActor(fool, foolSum, governanceContract, governanceToken, governance);
      await actorStake(fool, foolSum, governanceContract, governanceToken);

      const totalVotes = await governanceContract.totalVotes({from: governance});
      const receipt = await governanceContract.revoke({from: fool});
      expectEvent(receipt, 'RevokeVoter', {
        _voter: fool,
        _votes: foolSum,
        _totalVotes: totalVotes.sub(foolSum)
      });
      expect(await governanceContract.voters(fool, {from: governance})).to.be.equal(false);
      expect(await governanceContract.votes(fool, {from: governance})).to.be.bignumber.equal(ZERO);
    });

    it('should not revoke not the voter', async () => {
      await expectRevert(governanceContract.revoke({from: charlie}),
        '!voter');
    });

    it('should vote for', async () => {

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await governanceContract.setPeriod(periodForVoting, {from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      const receipt = await governanceContract.voteFor(oldProposalCount, {from: alice});
      expectEvent(receipt, 'Vote', {
        _id: oldProposalCount,
        _voter: alice,
        _vote: true,
        _weight: new BN('102000000000000000000')
      });
    });

    it('should vote against', async () => {

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await governanceContract.setPeriod(periodForVoting, {from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      const receipt = await governanceContract.voteAgainst(oldProposalCount, {from: alice});
      expectEvent(receipt, 'Vote', {
        _id: oldProposalCount,
        _voter: alice,
        _vote: false,
        _weight: new BN('102000000000000000000')
      });
    });

    it('should not vote against when time has passed', async () => {

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await governanceContract.setPeriod(periodForVoting, {from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      await time.increase(time.duration.days(1));
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await expectRevert(governanceContract.voteAgainst(oldProposalCount, {from: alice}), '>end');
    });

    it('should not vote for when time has passed', async () => {

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await governanceContract.setPeriod(periodForVoting, {from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      await time.increase(time.duration.days(1));
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await expectRevert(governanceContract.voteFor(oldProposalCount, {from: alice}), '>end');
    });

    it('should get stats of the votes', async () => {

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);
      await activeActor(bob, bobSum, governanceContract, governanceToken, governance);
      await actorStake(bob, bobSum, governanceContract, governanceToken);


      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      await governanceContract.voteFor(oldProposalCount, {from: alice});
      await governanceContract.voteAgainst(oldProposalCount, {from: bob});
      var { _for, _against, _quorum } = await governanceContract.getStats(
        oldProposalCount,
        {from: governance}
      );
      expect(_for).to.be.bignumber.equal(new BN('4975'));
      expect(_against).to.be.bignumber.equal(new BN('5024'));
      expect(_quorum).to.be.bignumber.equal(new BN('10000'));
    });

    it('should get last time reward applicable', async () => {
      const periodFinish = await governanceContract.periodFinish({from: governance});
      const lastTimeRewardApplicable = await governanceContract.lastTimeRewardApplicable({from: governance});
      expect(lastTimeRewardApplicable).to.be.bignumber.equal(periodFinish);
    });

    it('should fail to stake governance tokens if zero provided', async () => {
      await expectRevert(governanceContract.stake(ZERO, {from: fool}), '!stake 0');
    });

    it('should stake governance tokens if sender is not a voter', async () => {
      await governanceToken.approve(charlie, charlieSum, {from: governance});
      await governanceToken.transfer(charlie, charlieSum, {from: governance});
      await governanceToken.approve(governanceContract.address, charlieSum, {from: charlie});
      const receipt = await governanceContract.stake(charlieSum, {from: charlie});
      expectEvent(receipt, 'Staked', {
        _user: charlie,
        _amount: charlieSum
      });
    });

    it('should stake governance tokens and add votes if sender is voter', async () => {

      await activeActor(bob, bobSum, governanceContract, governanceToken, governance);

      await governanceToken.approve(governanceContract.address, bobSum, {from: bob});
      const oldTotalVotes = await governanceContract.totalVotes({from: governance});
      const receipt = await governanceContract.stake(bobSum, {from: bob});
      expectEvent(receipt, 'Staked', {
        _user: bob,
        _amount: bobSum
      });
      expect(await governanceContract.totalVotes({from: governance})).to.be.bignumber.equal(oldTotalVotes.add(bobSum));
    });

    it('should withdraw governance tokens', async () => {

      await activeActor(bob, bobSum, governanceContract, governanceToken, governance);

      await governanceContract.setBreaker(true, {from: governance});
      await governanceToken.approve(governanceContract.address, bobSum, {from: bob});
      const oldBalance = await governanceToken.balanceOf(bob, {from: bob});
      await governanceContract.stake(bobSum, {from: bob});
      const oldTotalVotes = await governanceContract.totalVotes({from: governance});
      const receipt = await governanceContract.withdraw(bobSum, {from: bob});
      // event Withdrawn(address indexed _user, uint256 _amount);
      expectEvent(receipt, 'Withdrawn', {
        _user: bob,
        _amount: bobSum
      });
      expect(await governanceContract.totalVotes({from: governance})).to.be.bignumber.equal(oldTotalVotes.sub(bobSum));
    });

    it('should not withdraw governance tokens if zero provided', async () => {
      await expectRevert(governanceContract.withdraw(ZERO, {from: fool}), '!withdraw 0');
    });

    it('should fail if vote locked', async () => {

      await activeActor(bob, bobSum, governanceContract, governanceToken, governance);
      await actorStake(bob, bobSum, governanceContract, governanceToken);
      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await governanceContract.setPeriod(periodForVoting, {from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      await governanceContract.voteAgainst(oldProposalCount, {from: bob});
      await expectRevert(governanceContract.withdraw(bobSum, {from: bob}), '!locked');
    });

    it('should not transfer reward amounts to caller if locked', async () => {
        await expectRevert(governanceContract.getReward({from: bob}), '!voted');
    });

    it('should transfer reward amounts to caller', async () => {

      const someAdditionalSum = ether('3');
      const bobsNewSum = someAdditionalSum.add(bobSum);

      await activeActor(bob, bobsNewSum, governanceContract, governanceToken, governance);

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await governanceToken.approve(governanceContract.address, bobSum, {from: bob});
      await governanceContract.stake(bobSum, {from: bob});
      await governanceContract.setPeriod(periodForVoting, {from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      await governanceContract.voteAgainst(oldProposalCount, {from: bob});

      const someRandomReward = ether('1');
      await stakingRewardsToken.approve(governanceContract.address, someRandomReward, {from: governance});
      await governanceContract.notifyRewardAmount(someRandomReward, {from: governance});
      await time.increase(time.duration.days(9));

      const reward = await governanceContract.earned(bob, {from: bob});
      const receipt = await governanceContract.getReward({from: bob});

      expectEvent(receipt, 'RewardPaid', {
        _user: bob,
        _reward: reward
      });
    });

    it('should revert notify reward amount if sender is not reward distribution', async () => {
      await expectRevert(governanceContract.notifyRewardAmount(ether('100'), {from: alice}), "!rewardDistribution");
    });

    it('should transfer reward amounts to reward distributor if period finished', async () => {
      const someRandomReward = ether('1');
      await stakingRewardsToken.approve(governanceContract.address, someRandomReward, {from: governance});
      const receipt = await governanceContract.notifyRewardAmount(someRandomReward, {from: governance});
      const DURATION = await governanceContract.DURATION({from: governance});
      const rewardRate = await governanceContract.rewardRate({from: governance});
      expect(rewardRate).to.be.bignumber.equal(someRandomReward.div(DURATION));
      expectEvent(receipt, 'RewardAdded', {
        _reward: someRandomReward
      });
    });

    it('should transfer reward amounts to reward distributor if period not finished', async () => {

      await activeActor(alice, aliceSum, governanceContract, governanceToken, governance);
      await actorStake(alice, aliceSum, governanceContract, governanceToken);

      await activeActor(bob, bobSum, governanceContract, governanceToken, governance);

      const DURATION = await governanceContract.DURATION({from: governance});
      var oldProposalCount = await governanceContract.proposalCount({from: governance});
      await governanceContract.propose(alice, proposalHash, {from: alice});
      await governanceContract.voteAgainst(oldProposalCount, {from: bob});
      await time.increase(time.duration.days(9));

      const someRandomReward = ether('1');
      await stakingRewardsToken.approve(governanceContract.address, someRandomReward, {from: governance});

      var rewardRate = await governanceContract.rewardRate({from: governance});
      const periodFinish = await governanceContract.periodFinish({from: governance});
      const latestTime = await time.latest();

      const receipt = await governanceContract.notifyRewardAmount(someRandomReward, {from: governance});

      const remaining = periodFinish.sub(latestTime);
      const leftover = remaining.mul(rewardRate);
      const trueRewardRate = someRandomReward.add(leftover).div(DURATION)

      rewardRate = await governanceContract.rewardRate({from: governance});

      expect(rewardRate).to.be.bignumber.equal(trueRewardRate);
      expectEvent(receipt, 'RewardAdded', {
        _reward: someRandomReward
      });
    });
  });

  it('should get reward per token', async () => {
    var stakingRewardsToken = await MockToken.new('Third Mock Token', 'TMT', ether('100'));
    var governanceToken = await GovernanceToken.new(0, {from: governance});
    var governanceContract = await Governance.new();
    await governanceContract.configure(
      stardId,
      stakingRewardsToken.address,
      governance,
      governanceToken.address,
      governance
    );

    var rewardPerToken = await governanceContract.rewardPerToken({from: governance});
    var rewardPerTokenStored = await governanceContract.rewardPerTokenStored({from: governance});
    expect(rewardPerToken).to.be.bignumber.equal(rewardPerTokenStored);

    governanceToken = await GovernanceToken.new(initialTotalSupply, {from: governance});
    governanceContract = await Governance.new();
    await governanceContract.configure(
      stardId,
      stakingRewardsToken.address,
      governance,
      governanceToken.address,
      governance
    );

    const someSumToStake = ether('1');
    await governanceToken.approve(governanceContract.address, someSumToStake, {from: governance});
    await governanceContract.stake(someSumToStake, {from: governance});

    rewardPerTokenStored = await governanceContract.rewardPerTokenStored({from: governance});
    const lastTimeRewardApplicable = await governanceContract.lastTimeRewardApplicable({from: governance});
    const lastUpdateTime = await governanceContract.lastUpdateTime({from: governance});
    const rewardRate = await governanceContract.rewardRate({from: governance});
    const totalSupply = await governanceContract.totalSupply({from: governance});

    // console.log(rewardPerTokenStored.toString(),
    //   lastTimeRewardApplicable.toString(),
    //   lastUpdateTime.toString(),
    //   rewardRate.toString(),
    //   totalSupply.toString());

    rewardPerToken = await governanceContract.rewardPerToken({from: governance});

    // console.log(totalSupply.toString());

    const trueRewardPerToken = rewardPerTokenStored.add(
      lastTimeRewardApplicable
        .sub(lastUpdateTime)
        .mul(rewardRate)
        .mul(CONVERSION_WEI_CONSTANT)
        .div(totalSupply)
    );
    // console.log(rewardPerToken, trueRewardPerToken);
    expect(rewardPerToken).to.be.bignumber.equal(trueRewardPerToken);
  });

  it('should get count of earned staking reward tokens', async () => {
    const mock = await MockContract.new();
    const stakingRewardsToken = await MockToken.new('Fourth Mock Token', 'FMT', ether('100'));
    const governanceContract = await Governance.new();
    const mockedGovernanceToken = await GovernanceToken.at(mock.address);
    await governanceContract.configure(
      stardId,
      stakingRewardsToken.address,
      governance,
      mockedGovernanceToken.address,
      governance
    );

    const balanceOfAccountABI = governanceContract.contract.methods.balanceOf(ZERO_ADDRESS).encodeABI();
    const rewardPerTokenABI = governanceContract.contract.methods.rewardPerToken().encodeABI();
    const userRewardPerTokenPaidABI = governanceContract.contract.methods.userRewardPerTokenPaid(ZERO_ADDRESS).encodeABI();
    const rewardsABI = governanceContract.contract.methods.rewards(ZERO_ADDRESS).encodeABI();

    await mock.givenMethodReturnUint(balanceOfAccountABI, ether('5'));

    const balanceOfAccount = await governanceContract.balanceOf(governance, {from: governance});
    const rewardPerToken = await governanceContract.rewardPerToken({from: governance});
    const userRewardPerTokenPaid = await governanceContract.userRewardPerTokenPaid(governance, {from: governance});
    const rewards = await governanceContract.rewards(governance, {from: governance});

    const earned = await governanceContract.earned(governance, {from: governance});

    const trueEarned = balanceOfAccount
        .mul(rewardPerToken.sub(userRewardPerTokenPaid))
        .div(CONVERSION_WEI_CONSTANT)
        .add(rewards);

    // console.log(
    //   `balance of governance: ${balanceOfAccount}`,
    //   `reward per token: ${rewardPerToken}`,
    //   `user reward per token paid: ${userRewardPerTokenPaid}`,
    //   `rewards: ${rewards}`,
    //   `true earned: ${trueEarned}`,
    //   `const: ${CONVERSION_WEI_CONSTANT}`,
    //   `earned: ${earned}`
    // );
    expect(earned).to.be.bignumber.equal(trueEarned);
  });
});
