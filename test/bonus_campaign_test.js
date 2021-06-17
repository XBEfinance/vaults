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
const { accounts, contract } = require('@openzeppelin/test-environment');
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
} = require("./utils/deploy_strategy_infrastructure.js");

const { ZERO_ADDRESS } = constants;
const MockContract = contract.fromArtifact("MockContract");

describe("BonusCampaign", () => {

  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let mockXBE;
  let mockCX;
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let vaultWithXBExCXStrategy;
  let mockedStrategy;

  let deployment;

  beforeEach(async () => {
    mockedStrategy = await MockContract.new();
    [
      vaultWithXBExCXStrategy,
      mockXBE,
      mockCX,
      xbeInflation,
      bonusCampaign,
      veXBE,
      voting
    ] = await beforeEachWithSpecificDeploymentParams(
      owner, alice, bob, mockedStrategy,
      async () => {
        defaultParams.bonusCampaign.mintTime = await time.latest();
      }
    );
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
    await expectRevert(bonusCampaign.notifyRewardAmount(ZERO, {from: owner}), "!allowed");
  });

  describe('register', () => {
    it('should register correctly', async () => {
      await bonusCampaign.startMint({from: owner});

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
      await bonusCampaign.startMint({from: owner});

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
      await bonusCampaign.startMint({from: owner});

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
      await bonusCampaign.startMint({from: owner});
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
      const result = await bonusCampaign.startMint({from: owner});
      const rewardsDuration = await bonusCampaign.rewardsDuration();
      // const blockTimestamp = new BN(
      //   (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp.toString()
      // );
      expectEvent(result, "RewardAdded", {
        reward: defaultParams.bonusCampaign.emission
      });
      // expect(await bonusCampaign.lastUpdateTime()).to.be.bignumber.equal(blockTimestamp);
      // expect(await bonusCampaign.periodFinish()).to.be.bignumber.equal(blockTimestamp.add(rewardsDuration));
    });

    it('should not start a minting campaign if called by not by reward distribution', async () => {
      await expectRevert(bonusCampaign.startMint({from: alice}), "Caller is not RewardsDistribution contract");
    });

    it('should not start a minting campaign if called for too soon', async () => {
      mockedStrategy = await MockContract.new();
      [
        vaultWithXBExCXStrategy,
        mockXBE,
        mockCX,
        xbeInflation,
        bonusCampaign,
        veXBE,
        voting
      ] = await beforeEachWithSpecificDeploymentParams(
        owner, alice, bob, mockedStrategy,
        async () => {
          defaultParams.bonusCampaign.mintTime = (await time.latest()).add(days('2'));
        }
      );
      await expectRevert(bonusCampaign.startMint({from: owner}), "cannotMintYet");
    })
  });

});
