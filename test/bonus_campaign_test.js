/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require("chai");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require("@openzeppelin/test-helpers");
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require("./utils/common.js");
const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
  months,
  beforeEachWithSpecificDeploymentParams
} = require("./utils/deploy_infrastructure.js");

const { ZERO_ADDRESS } = constants;

contract("BonusCampaign", (accounts) => {

  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let mockXBE;
  let mockCRV;
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let stakingRewards;
  let vaultWithXBExCRVStrategy;

  let deployment;

  beforeEach(async () => {
    [
      vaultWithXBExCRVStrategy,
      mockXBE,
      mockCRV,
      xbeInflation,
      bonusCampaign,
      veXBE,
      voting,
      stakingRewards
    ] = await beforeEachWithSpecificDeploymentParams(owner, alice, bob, async () => {
      defaultParams.bonusCampaign.mintTime = await time.latest();
    });
  });

  it('should configure properly', async () => {
    expect(await bonusCampaign.rewardsToken()).to.be.equal(
      mockXBE.address
    );
    expect(await bonusCampaign.stakingToken()).to.be.equal(
      veXBE.address
    );
    expect(await bonusCampaign.rewardsDistribution()).to.be.equal(
      owner
    );
    expect(await bonusCampaign.rewardsDuration()).to.be.bignumber.equal(
      defaultParams.bonusCampaign.rewardsDuration
    );
    expect(await bonusCampaign.bonusEmission()).to.be.bignumber.equal(
      defaultParams.bonusCampaign.emission
    );
    expect(await bonusCampaign.startMintTime()).to.be.bignumber.equal(
      defaultParams.bonusCampaign.mintTime
    );
  });

  it('should revert default stake', async () => {
    await expectRevert(bonusCampaign.stake(ZERO), "!allowed");
  });

  it('should revert default withdraw', async () => {
    await expectRevert(bonusCampaign.withdraw(ZERO), "!allowed");
  });

  it('should revert default notify', async () => {
    await expectRevert(bonusCampaign.notifyRewardAmount(ZERO), "!allowed");
  });

  describe('register', () => {
    it('should register correctly', async () => {
      await bonusCampaign.startMint();

      const xbeToDeposit = ether("1");
      const lockTime = (await time.latest()).add(months("24"));
      await mockXBE.approve(veXBE.address, xbeToDeposit, { from: alice });
      await veXBE.createLock(xbeToDeposit, lockTime, { from: alice });

      const result = await bonusCampaign.register({from: alice});
      expect(await bonusCampaign.registered(alice)).to.be.true;
      expectEvent(result, "Staked", {
        user: alice
      });
    });

    it('should not register if already registered', async () => {
      const xbeToDeposit = ether("1");
      const lockTime = (await time.latest()).add(months("24"));
      await mockXBE.approve(veXBE.address, xbeToDeposit, { from: alice });
      await veXBE.createLock(xbeToDeposit, lockTime, { from: alice });

      await bonusCampaign.register({from: alice});
      await expectRevert(bonusCampaign.register({from: alice}), "alreadyRegistered");
    });

    it('should not register if locked veXBE for too little time', async () => {
      const xbeToDeposit = ether("1");
      const lockTime = (await time.latest()).add(months("22"));
      await mockXBE.approve(veXBE.address, xbeToDeposit, { from: alice });
      await veXBE.createLock(xbeToDeposit, lockTime, { from: alice });
      await expectRevert(bonusCampaign.register({from: alice}), "stakedForNotEnoughTime");
    });

    it('should not register if locked none veXBE', async () => {
      await expectRevert(bonusCampaign.register({from: alice}), "!stake0");
    });

  });

  describe("getReward", () => {

    it('should get reward properly', async () => {
      await bonusCampaign.startMint();

      const xbeToDeposit = ether("1");
      const lockTime = (await time.latest()).add(months("24"));
      await mockXBE.approve(veXBE.address, xbeToDeposit, { from: alice });
      await veXBE.createLock(xbeToDeposit, lockTime, { from: alice });
      await bonusCampaign.register({from: alice});

      await time.increaseTo((await bonusCampaign.periodFinish()).add(days('1')));

      const expectedReward = await bonusCampaign.earned(alice);

      const result = await bonusCampaign.getReward({from: alice});
      expectEvent(result, "RewardPaid", {
        user: alice,
        reward: expectedReward
      });
    });

    it('should not get reward if not registered', async () => {
      await bonusCampaign.startMint();

      const xbeToDeposit = ether("1");
      const lockTime = (await time.latest()).add(months("24"));
      await mockXBE.approve(veXBE.address, xbeToDeposit, { from: alice });
      await veXBE.createLock(xbeToDeposit, lockTime, { from: alice });

      await time.increaseTo((await bonusCampaign.periodFinish()).add(days('1')));

      const expectedReward = await bonusCampaign.earned(alice);

      const result = await bonusCampaign.getReward({from: alice});
      expectEvent.notEmitted(result, "RewardPaid");
    });

    it('should not get reward if called for too soon', async () => {
      await bonusCampaign.startMint();
      const xbeToDeposit = ether("1");
      const lockTime = (await time.latest()).add(months("24"));
      await mockXBE.approve(veXBE.address, xbeToDeposit, { from: alice });
      await veXBE.createLock(xbeToDeposit, lockTime, { from: alice });
      await bonusCampaign.register({from: alice});
      await time.increaseTo((await bonusCampaign.periodFinish()).sub(days('1')));
      await expectRevert(bonusCampaign.getReward({from: alice}), "isNotYetFinished");
    });
  });

  describe('startMint', () => {
    it('should start a minting campaign', async () => {
      const result = await bonusCampaign.startMint();
      const rewardsDuration = await bonusCampaign.rewardsDuration();
      const blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString()
      );
      expectEvent(result, "RewardAdded", {
        reward: defaultParams.bonusCampaign.emission
      });
      expect(await bonusCampaign.lastUpdateTime()).to.be.bignumber.equal(blockTimestamp);
      expect(await bonusCampaign.periodFinish()).to.be.bignumber.equal(blockTimestamp.add(rewardsDuration));
    });

    it('should not start a minting campaign if called by not by reward distribution', async () => {
      await expectRevert(bonusCampaign.startMint({from: alice}), "Caller is not RewardsDistribution contract");
    });

    it('should not start a minting campaign if called for too soon', async () => {
      [
        vaultWithXBExCRVStrategy,
        mockXBE,
        mockCRV,
        xbeInflation,
        bonusCampaign,
        minter,
        gaugeController,
        veXBE,
        voting,
        stakingRewards,
        liquidityGaugeReward,
      ] = await beforeEachWithSpecificDeploymentParams(owner, alice, bob, async () => {
        defaultParams.bonusCampaign.mintTime = (await time.latest()).add(days('2'));
      });
      await expectRevert(bonusCampaign.startMint(), "cannotMintYet");
    })
  });

});
