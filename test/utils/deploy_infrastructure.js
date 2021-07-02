const {
  BN,
  ether,
  expectRevert,
  constants,
} = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require("./common.js");

const YEAR = new BN("86400").mul(new BN("365"));
const MULTIPLIER = new BN("10").pow(new BN("18"));
const days = (n) => new BN("60").mul(new BN("1440").mul(new BN(n)));
const months = (n) => days("30").mul(new BN(n));

// const Minter = artifacts.require("Minter");
const XBEInflation = artifacts.require("XBEInflation");
const GaugeController = artifacts.require("GaugeController");
const VeXBE = artifacts.require("VeXBE");
// const LiquidityGaugeReward = artifacts.require("LiquidityGaugeReward");
const Voting = artifacts.require("Voting");
const StakingRewards = artifacts.require("StakingRewards");
const BonusCampaign = artifacts.require("BonusCampaign");
const MockToken = artifacts.require("MockToken");
const ReferralProgram = artifacts.require("ReferralProgram");

const defaultParams = {
  vaultWithXBExCRVStrategyAddress: ZERO_ADDRESS,
  liquidityGaugeReward: {
    boostWarmup: ZERO, // new BN('2').mul(new BN('7')).mul(new BN('86400')),
    rewardsDuration: days("365"),
    typeName: "standard",
    startingTypeWeight: new BN("10000").div(new BN("8")), // 100% in base points divided by 8 different gauges
    startingGaugeWeight: new BN("10000").div(new BN("8")),
  },
  bonusCampaign: {
    rewardsDuration: months("23"),
    emission: ether("5000"),
    mintTime: ZERO,
  },
  mockTokens: {
    mockedTotalSupplyXBE: ether("1000"),
    mockedTotalSupplyCRV: ether("1000"),
    mockedTotalSupplyCVX: ether("1000"),
    mockedAmountXBE: ether("100"),
    mockedAmountCRV: ether("100"),
    mockedAmountCVX: ether("100"),
  },
  xbeinflation: {
    initialSupply: new BN("5000"),
    initialRate: new BN("274815283").mul(MULTIPLIER).div(YEAR), // new BN('10000').mul(MULTIPLIER).div(YEAR)
    rateReductionTime: YEAR,
    rateReductionCoefficient: new BN("1189207115002721024"), // new BN('10').mul(MULTIPLIER)
    rateDenominator: MULTIPLIER,
    inflationDelay: new BN("86400"),
  },
  voting: {
    supportRequiredPct: new BN("5100"),
    minAcceptQuorumPct: new BN("3000"),
    voteTime: new BN("1000000"),
  },
};

const deployInfrastructure = (owner, alice, bob, params) => {
  let mockXBE;
  let mockCRV;
  let mockCVX;
  let xbeInflation;
  let bonusCampaign;
  let minter;
  let gaugeController;
  let veXBE;
  let voting;
  let stakingRewards;
  let liquidityGaugeReward;
  let referralProgram;

  const proceed = async () => {
    mockXBE = await getMockTokenPrepared(
      alice,
      params.mockTokens.mockedAmountXBE,
      params.mockTokens.mockedTotalSupplyXBE,
      owner
    );
    mockCRV = await getMockTokenPrepared(
      alice,
      params.mockTokens.mockedAmountCRV,
      params.mockTokens.mockedTotalSupplyCRV,
      owner
    );
    mockCVX = await getMockTokenPrepared(
      alice,
      params.mockTokens.mockedAmountCVX,
      params.mockTokens.mockedTotalSupplyCVX,
      owner
    );

    await mockXBE.approve(bob, params.mockTokens.mockedAmountXBE, {
      from: owner,
    });
    await mockXBE.transfer(bob, params.mockTokens.mockedAmountXBE, {
      from: owner,
    });

    await mockCRV.approve(bob, params.mockTokens.mockedAmountCRV, {
      from: owner,
    });
    await mockCRV.transfer(bob, params.mockTokens.mockedAmountCRV, {
      from: owner,
    });

    await mockCVX.approve(bob, params.mockTokens.mockedAmountCRV, {
      from: owner,
    });
    await mockCVX.transfer(bob, params.mockTokens.mockedAmountCRV, {
      from: owner,
    });

    xbeInflation = await XBEInflation.new();

    // deploy bonus campaign
    bonusCampaign = await BonusCampaign.new();

    // deploy minter
    minter = await Minter.new();

    // deploy gauge controller
    gaugeController = await GaugeController.new();

    // deploy voting escrow
    veXBE = await VeXBE.new();

    // deploy voting
    voting = await Voting.new();

    // deploy staking rewards
    stakingRewards = await StakingRewards.new();

    // deploy liquidity gauge
    liquidityGaugeReward = await LiquidityGaugeReward.new();

    referralProgram = await ReferralProgram.new();

    return [
      mockXBE,
      mockCRV,
      mockCVX,
      xbeInflation,
      bonusCampaign,
      minter,
      gaugeController,
      veXBE,
      voting,
      stakingRewards,
      liquidityGaugeReward,
      referralProgram
    ];
  };

  const configure = async () => {
    await xbeInflation.configure(
      mockXBE.address,
      minter.address,
      params.xbeinflation.initialSupply,
      params.xbeinflation.initialRate,
      params.xbeinflation.rateReductionTime,
      params.xbeinflation.rateReductionCoefficient,
      params.xbeinflation.rateDenominator,
      params.xbeinflation.inflationDelay
    );

    await bonusCampaign.methods[
      "configure(address,address,uint256,uint256,uint256)"
    ](
      mockXBE.address,
      veXBE.address,
      params.bonusCampaign.mintTime,
      params.bonusCampaign.rewardsDuration,
      params.bonusCampaign.emission
    );

    await minter.configure(xbeInflation.address, gaugeController.address);

    await gaugeController.configure(xbeInflation.address, veXBE.address);

    await veXBE.configure(
      mockXBE.address,
      "Voting Escrowed XBE",
      "veXBE",
      "0.0.1"
    );

    await voting.initialize(
      veXBE.address,
      params.voting.supportRequiredPct,
      params.voting.minAcceptQuorumPct,
      params.voting.voteTime
    );

    await stakingRewards.configure(
      owner,
      mockCRV.address,
      params.vaultWithXBExCRVStrategyAddress,
      params.liquidityGaugeReward.rewardsDuration
    );

    await liquidityGaugeReward.initialize(
      params.vaultWithXBExCRVStrategyAddress,
      minter.address,
      stakingRewards.address,
      mockCRV.address,
      owner,
      params.liquidityGaugeReward.boostWarmup
    );

    await gaugeController.addType(
      params.liquidityGaugeReward.typeName,
      params.liquidityGaugeReward.startingTypeWeight
    );

    await gaugeController.addGauge(
      liquidityGaugeReward.address,
      ZERO,
      params.liquidityGaugeReward.startingGaugeWeight
    );

    await gaugeController.checkpointGauge(liquidityGaugeReward.address);

    await referralProgram.configure(
      [
        mockCRV.address,
        mockCVX.address,
        mockXBE.address,
      ],
      owner
    );
  };

  return {
    proceed,
    configure,
  };
};

const beforeEachWithSpecificDeploymentParams = async (owner, alice, bob, middleware) => {
  const vaultWithXBExCRVStrategy = await getMockTokenPrepared(
    alice,
    ether("100"),
    ether("1000"),
    owner
  );
  await vaultWithXBExCRVStrategy.approve(bob, ether("100"));
  await vaultWithXBExCRVStrategy.transfer(bob, ether("100"));
  defaultParams.vaultWithXBExCRVStrategyAddress =
    vaultWithXBExCRVStrategy.address;

  if (middleware) {
    await middleware();
  }

  deployment = deployInfrastructure(owner, alice, bob, defaultParams);
  const result = await deployment.proceed();
  await deployment.configure();
  return [vaultWithXBExCRVStrategy, ...result];
};

module.exports = {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  months,
  defaultParams,
  beforeEachWithSpecificDeploymentParams
};
