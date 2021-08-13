/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  // constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const common = require('./utils/common.js');
const constants = require('./utils/constants.js');
const environment = require('./utils/environment.js');
const { people, setPeople } = require('./utils/accounts.js');

let mockXBE;
let bonusCampaign;
let veXBE;
let votingStakingRewards;
let lockSubscription;

contract('BonusCampaign', (accounts) => {
  setPeople(accounts);

  beforeEach(async () => {
    [
        mockXBE,
        veXBE,
        bonusCampaign,
        votingStakingRewards,
        lockSubscription,
    ] = await environment.getGroup(environment.defaultGroup,
        (key) => {
            return [
                "MockXBE",
                "VeXBE",
                "BonusCampaign",
                "VotingStakingRewards",
                "LockSubscription",
            ].includes(key);
        },
        true
    );
  });

  it('should configure properly', async () => {
    expect(await bonusCampaign.rewardsToken()).to.be.equal(
      mockXBE.address,
    );

    expect(await bonusCampaign.stakingToken()).to.be.equal(
      veXBE.address,
    );

    expect(await bonusCampaign.rewardsDistribution()).to.be.equal(
      people.owner,
    );

    expect(await bonusCampaign.rewardsDuration()).to.be.bignumber.equal(
      constants.localParams.bonusCampaign.rewardsDuration,
    );

    expect(await bonusCampaign.bonusEmission()).to.be.bignumber.equal(
      constants.localParams.bonusCampaign.emission,
    );

    const startMintTime = constants.localParams.bonusCampaign.configureTime.add(
      constants.localParams.bonusCampaign.startMintTime
    );

    expect(await bonusCampaign.startMintTime())
      .to.be.bignumber.equal(startMintTime);

    // check subscription
    expect((await lockSubscription.subscribersCount()).toString())
      .to.be.equal('1');

    expect(await lockSubscription.subscriberAt(new BN('0')))
      .to.be.equal(bonusCampaign.address);

    expect(await lockSubscription.eventSource())
      .to.be.equal(veXBE.address);
  });

  it('should revert default stake', async () => {
    await expectRevert(bonusCampaign.stake(constants.utils.ZERO), '!allowed');
  });

  it('should revert default withdraw', async () => {
    await expectRevert(bonusCampaign.withdraw(constants.utils.ZERO), '!allowed');
  });

  it('should revert default notify', async () => {
    await expectRevert(bonusCampaign.notifyRewardAmount(constants.utils.ZERO, { from: people.owner }), '!allowed');
  });

  describe('register', () => {
    it('should register correctly', async () => {
      // console.log('here0');

      await bonusCampaign.startMint({ from: people.owner });

      const xbeToDeposit = ether('1');
      const lockTime = (await time.latest()).add(common.months('24'));
      await mockXBE.approve(veXBE.address, xbeToDeposit, { from: people.alice });

      // console.log('lockTime = ', lockTime.toString());
      // console.log('xbeToDeposit = ', xbeToDeposit.toString());
      await mockXBE.approve(
        votingStakingRewards.address,
        xbeToDeposit,
        { from: people.alice },
      );
      await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });

      // !registered && can register
      expect(await bonusCampaign.registered(people.alice)).to.be.false;
      expect(await bonusCampaign.canRegister(people.alice)).to.be.true;

      const receipt = await veXBE.createLock(xbeToDeposit, lockTime, { from: people.alice });
      // await expectEvent(
      //   receipt,
      //   'Staked'
      // );

      expect(await bonusCampaign.canRegister(people.alice)).to.be.false;
      expect(await bonusCampaign.registered(people.alice)).to.be.true;
    });

    it('should not register if already registered', async () => {
      const xbeToDeposit = ether('1');
      const lockTime = (await time.latest()).add(common.months('24'));
      await mockXBE.approve(votingStakingRewards.address, xbeToDeposit, { from: people.alice });
      await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });

      await lockSubscription.setActive(false); // switch off autoregistration
      await veXBE.createLock(xbeToDeposit, lockTime, { from: people.alice });

      expect(await bonusCampaign.registered(people.alice)).to.be.false;
      expect(await bonusCampaign.canRegister(people.alice)).to.be.true;

      await bonusCampaign.register({ from: people.alice });

      expect(await bonusCampaign.registered(people.alice)).to.be.true;
      expect(await bonusCampaign.canRegister(people.alice)).to.be.false;

      await expectRevert(bonusCampaign.register({ from: people.alice }), 'alreadyRegistered');
    });

    it('should not register if locked veXBE for too little time', async () => {
      const xbeToDeposit = ether('1');
      const lockTime = (await time.latest()).add(common.months('22'));
      await mockXBE.approve(votingStakingRewards.address, xbeToDeposit, { from: people.alice });
      await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });
      await veXBE.createLock(xbeToDeposit, lockTime, { from: people.alice });
      expect(await bonusCampaign.registered(people.alice)).to.be.false;
      await expectRevert(bonusCampaign.register({ from: people.alice }), 'stakedForNotEnoughTime');
    });

    it('should not register if locked none veXBE', async () => {
      await expectRevert(bonusCampaign.register({ from: people.alice }), '!stake0');
    });
  });

  describe('getReward', () => {
    it('should get reward properly', async () => {
      await bonusCampaign.startMint({ from: people.owner });

      const xbeToDeposit = ether('1');
      const lockTime = (await time.latest()).add(common.months('24'));
      await mockXBE.approve(
        votingStakingRewards.address,
        xbeToDeposit,
        { from: people.alice },
      );
      await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });

      expect(await bonusCampaign.canRegister(people.alice))
        .to.be.true;
      expect(await bonusCampaign.registered(people.alice))
        .to.be.false;

      await veXBE.createLock(xbeToDeposit, lockTime, { from: people.alice });
      expect(await bonusCampaign.registered(people.alice))
        .to.be.true;
      expect(await bonusCampaign.canRegister(people.alice))
        .to.be.false;

      console.log((await bonusCampaign.balanceOf(people.alice)).toString());
      await expectRevert(
        bonusCampaign.register({ from: people.alice }),
        'alreadyRegistered',
      );

      // await time.increase((await bonusCampaign.rewardsDuration()).add(common.days('1')));
      await time.increase(common.months('1'));

      const expectedReward = await bonusCampaign.earned(people.alice);
      console.log(expectedReward.toString());

      const result = await bonusCampaign.getReward({ from: people.alice });
      expectEvent(result, 'RewardPaid',
        {
        user: people.alice,
        reward: expectedReward,
      }
      );
    });

    it('should not get reward if not registered', async () => {
      await bonusCampaign.startMint({ from: people.owner });

      const xbeToDeposit = ether('1');
      const lockTime = (await time.latest()).add(common.months('24'));
      await mockXBE.approve(votingStakingRewards.address, xbeToDeposit, { from: people.alice });
      await votingStakingRewards.stake(xbeToDeposit, { from: people.alice });
      await lockSubscription.setActive(false); // disable auto-registration
      await veXBE.createLock(xbeToDeposit, lockTime, { from: people.alice });

      await time.increase((await bonusCampaign.rewardsDuration()).add(common.days('1')));

      const expectedReward = await bonusCampaign.earned(people.alice);

      const result = await bonusCampaign.getReward({ from: people.alice });
      expectEvent.notEmitted(result, 'RewardPaid');
    });

  });

  describe('startMint', () => {
    it('should start a minting campaign', async () => {
      const result = await bonusCampaign.startMint({ from: people.owner });
      const rewardsDuration = await bonusCampaign.rewardsDuration();
      // const blockTimestamp = new BN(
      //   (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp.toString()
      // );
      expectEvent(result, 'RewardAdded', {
        reward: constants.localParams.bonusCampaign.emission,
      });
      // expect(await bonusCampaign.lastUpdateTime()).to.be.bignumber.equal(blockTimestamp);
      // expect(await bonusCampaign.periodFinish()).to.be.bignumber.equal(blockTimestamp.add(rewardsDuration));
    });

    it('should not start a minting campaign if called by not by reward distribution', async () => {
      await expectRevert(bonusCampaign.startMint({ from: people.alice }), 'Caller is not RewardsDistribution contract');
    });

  });
});
