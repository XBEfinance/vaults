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

const { ZERO_ADDRESS } = constants;
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
  processAllEvents
} = require("./utils/common.js");
const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
  beforeEachWithSpecificDeploymentParams
} = require("./utils/deploy_strategy_infrastructure.js");

const MockContract = contract.fromArtifact("MockContract");

contract("XBEInflation", () => {
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

  let deployment;

  describe('with default params of deployment', () => {

    beforeEach(async () => {
      [
        vaultWithXBExCXStrategy,
        mockXBE,
        mockCX,
        xbeInflation,
        bonusCampaign,
        veXBE,
        voting
      ] = await beforeEachWithSpecificDeploymentParams(owner, alice, bob);
    });

    it("should configure XBEInflation properly", async () => {
      expect(await xbeInflation.admin()).to.be.equal(owner);
      expect(await xbeInflation.minter()).to.be.equal(minter.address);
      expect(await xbeInflation.token()).to.be.equal(mockXBE.address);
      expect(await xbeInflation.initialSupply()).to.be.bignumber.equal(
        defaultParams.xbeinflation.initialSupply
      );
      expect(await xbeInflation.initialRate()).to.be.bignumber.equal(
        defaultParams.xbeinflation.initialRate
      );
      expect(await xbeInflation.rateReductionTime()).to.be.bignumber.equal(
        defaultParams.xbeinflation.rateReductionTime
      );
      expect(await xbeInflation.rateDenominator()).to.be.bignumber.equal(
        defaultParams.xbeinflation.rateDenominator
      );
      expect(await xbeInflation.inflationDelay()).to.be.bignumber.equal(
        defaultParams.xbeinflation.inflationDelay
      );
      expect(await xbeInflation.rateReductionCoefficient()).to.be.bignumber.equal(
        defaultParams.xbeinflation.rateReductionCoefficient
      );
      expect(
        (await xbeInflation.startEpochTime()).sub(
          (await time.latest())
            .add(defaultParams.xbeinflation.inflationDelay)
            .sub(defaultParams.xbeinflation.rateReductionTime)
        )
      ).to.be.bignumber.most(ONE);
      expect(await xbeInflation.miningEpoch()).to.be.bignumber.equal(
        new BN("-1")
      );
      expect(await xbeInflation.rate()).to.be.bignumber.equal(ZERO);

      const supplyInWei = defaultParams.xbeinflation.initialSupply.mul(
        new BN("10").pow(await mockXBE.decimals())
      );
      expect(await xbeInflation.totalMinted()).to.be.bignumber.equal(supplyInWei);
      expect(await xbeInflation.startEpochSupply()).to.be.bignumber.equal(
        supplyInWei
      );
    });

    it("should update minting parameters", async () => {
      await expectRevert(xbeInflation.updateMiningParameters(), "tooSoon");
      await time.increase(
        (await xbeInflation.rateReductionTime()).add(days('1'))
      );

      let expectedStartEpochSupply = await xbeInflation.startEpochSupply();
      let expectedRate = await xbeInflation.initialRate();
      let result = await xbeInflation.updateMiningParameters();
      let blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString()
      );

      processEventArgs(result, "UpdateMiningParameters", (args) => {
        expect(args.time).to.be.bignumber.equal(blockTimestamp);
        expect(args.rate).to.be.bignumber.equal(expectedRate);
        expect(args.supply).to.be.bignumber.equal(expectedStartEpochSupply);
      });

      await time.increase(
        await xbeInflation.rateReductionTime()
      );

      const oldRate = await xbeInflation.rate();
      const rateReductionTime = await xbeInflation.rateReductionTime();

      expectedStartEpochSupply = expectedStartEpochSupply.add(
        oldRate.mul(rateReductionTime)
      );

      expectedRate = oldRate
        .mul(await xbeInflation.rateDenominator())
        .div(await xbeInflation.rateReductionCoefficient());

      result = await xbeInflation.updateMiningParameters();

      blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString()
      );

      processEventArgs(result, "UpdateMiningParameters", (args) => {
        expect(args.time).to.be.bignumber.equal(blockTimestamp);
        expect(args.rate).to.be.bignumber.equal(expectedRate);
        expect(args.supply).to.be.bignumber.equal(expectedStartEpochSupply);
      });
    });

    it("should set minter role", async () => {
      expect(await xbeInflation.minter()).to.be.equal(minter.address);
    });

    it("should set admin role", async () => {
      await expectRevert(
        xbeInflation.setAdmin(ZERO_ADDRESS, { from: alice }),
        "!admin"
      );
      const result = await xbeInflation.setAdmin(alice);
      expect(await xbeInflation.admin()).to.be.equal(alice);
      processEventArgs(result, "SetAdmin", (args) => {
        expect(args.admin).to.be.equal(alice);
      });
    });

    it("should get current available supply", async () => {
      expect(await xbeInflation.availableSupply()).to.be.bignumber.equal(
        (await xbeInflation.startEpochSupply()).add(
          (await time.latest())
            .sub(await xbeInflation.startEpochTime())
            .mul(await xbeInflation.rate())
        )
      );
    });

    it("should get timestamp of the current mining epoch start while simultaneously updating minting parameters", async () => {

      let result = await xbeInflation.startEpochTimeWrite();
      await expectEvent.notEmitted(result, "UpdateMiningParameters");

      await time.increase(
        (await xbeInflation.startEpochTime()).add(
          await xbeInflation.rateReductionTime()
        )
      );

      result = await xbeInflation.startEpochTimeWrite();

      const startEpochTime = await xbeInflation.startEpochTime();

      const expectedStartEpochSupply = await xbeInflation.startEpochSupply();
      const expectedRate = await xbeInflation.initialRate();
      const blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString()
      );

      processEventArgs(result, "UpdateMiningParameters", (args) => {
        expect(args.time).to.be.bignumber.equal(blockTimestamp);
        expect(args.rate).to.be.bignumber.equal(expectedRate);
        expect(args.supply).to.be.bignumber.equal(expectedStartEpochSupply);
      });

      processEventArgs(result, "CalculatedEpochTimeWritten", (args) => {
        expect(args.epochTime).to.be.bignumber.equal(startEpochTime);
      });
    });

    it("should get timestamp of the next mining epoch start while simultaneously updating mining parameters", async () => {

      const startEpochTime = (await xbeInflation.startEpochTime())
        .add(await xbeInflation.rateReductionTime());

      let result = await xbeInflation.futureEpochTimeWrite();
      await expectEvent.notEmitted(result, "UpdateMiningParameters");

      await time.increase(
        (await xbeInflation.startEpochTime()).add(
          await xbeInflation.rateReductionTime()
        )
      );

      result = await xbeInflation.futureEpochTimeWrite();

      const expectedStartEpochSupply = await xbeInflation.startEpochSupply();
      const expectedRate = await xbeInflation.initialRate();
      const blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString()
      );

      processEventArgs(result, "UpdateMiningParameters", (args) => {
        expect(args.time).to.be.bignumber.equal(blockTimestamp);
        expect(args.rate).to.be.bignumber.equal(expectedRate);
        expect(args.supply).to.be.bignumber.equal(expectedStartEpochSupply);
      });

      processEventArgs(result, "CalculatedEpochTimeWritten", (args) => {
        expect(args.epochTime).to.be.bignumber.equal(startEpochTime);
      });

    });

  });

  describe("with specific deployment params", () => {

    beforeEach(async () => {
      [
        vaultWithXBExCXStrategy,
        mockXBE,
        mockCX,
        xbeInflation,
        bonusCampaign,
        veXBE,
        voting
      ] = await beforeEachWithSpecificDeploymentParams(owner, alice, bob,
        async () => {
          defaultParams.xbeinflation.rateReductionTime = days('2');
          defaultParams.xbeinflation.inflationDelay = defaultParams.xbeinflation.rateReductionTime;
          defaultParams.xbeinflation.initialRate = new BN('10').mul(MULTIPLIER);
        }
      );
    });

    it("should reject getting amount of how much can be minted during the interval if requires are failed", async () => {

      await expectRevert(
        xbeInflation.mintableInTimeframe(ONE, ZERO),
        "startGtEnd"
      );

      await time.increaseTo(
        (await xbeInflation.startEpochTime()).add(
          await xbeInflation.rateReductionTime()
        )
      );

      await xbeInflation.updateMiningParameters();

      const timeEnd = (await xbeInflation.startEpochTime()).add(
        await xbeInflation.rateReductionTime()
      );

      await expectRevert(
        xbeInflation.mintableInTimeframe(ZERO, timeEnd),
        "currentRateGtInitialRate"
      );

      const now = await time.latest();

      await expectRevert(
        xbeInflation.mintableInTimeframe(
          now,
          now.add(days('365').div(new BN('2')))
        ),
        "tooFarInFuture"
      );
    });

    it("should get amount of how much can be minted during the interval", async () => {

      const now = await time.latest();
      const mintableAmount = await xbeInflation.mintableInTimeframe(
        now,
        now.add(days('2'))
      );
      console.log(mintableAmount.toString());

    });

    it("should mint", async () => {
      await expectRevert(xbeInflation.mint(ZERO_ADDRESS, ZERO), "!zeroAddress");
      await expectRevert(xbeInflation.mint(alice, ZERO, {from: alice}), "!minter");

      const lpToDeposit = ether("2");

      await vaultWithXBExCXStrategy.approve(
        liquidityGaugeReward.address,
        lpToDeposit,
        { from: alice }
      );
      await liquidityGaugeReward.methods["deposit(uint256)"](lpToDeposit, {
        from: alice,
      });

      await time.increase(days('20'));

      const oldBalance = await mockXBE.balanceOf(alice);

      const result = await minter.mint(liquidityGaugeReward.address, {
        from: alice
      });
      const newBalance = await mockXBE.balanceOf(alice);

      processEventArgs(result, "Minted", (args) => {
        expect(args.recipient).to.be.equal(alice);
        expect(args.gauge).to.be.equal(liquidityGaugeReward.address);
        expect(args.minted).to.be.bignumber.equal(newBalance.sub(oldBalance));
      });
    });
  });
});
