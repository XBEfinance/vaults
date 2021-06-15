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

const XBEInflation = artifacts.require("XBEInflation");
const VeXBE = artifacts.require("VeXBE");
const Voting = artifacts.require("Voting");
const StakingRewards = artifacts.require("StakingRewards");
const BonusCampaign = artifacts.require("BonusCampaign");
const MockToken = artifacts.require("MockToken");

const defaultParams = {
  bonusCampaign: {
    rewardsDuration: months("23"),
    emission: ether("5000"),
    mintTime: ZERO,
  },
  mockTokens: {
    mockedTotalSupplyXBE: ether("1000"),
    mockedTotalSupplyCRV: ether("1000"),
    mockedAmountXBE: ether("100"),
    mockedAmountCRV: ether("100"),
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
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let stakingRewards;

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

    xbeInflation = await XBEInflation.new();

    // deploy bonus campaign
    bonusCampaign = await BonusCampaign.new();

    // deploy voting escrow
    veXBE = await VeXBE.new();

    // deploy voting
    voting = await Voting.new();

    // deploy staking rewards
    stakingRewards = await StakingRewards.new();


    return [
      mockXBE,
      mockCRV,
      xbeInflation,
      bonusCampaign,
      veXBE,
      voting,
      stakingRewards
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

    // await stakingRewards.configure(
    //   owner,
    //   mockCRV.address,
    //   params.vaultWithXBExCRVStrategyAddress,
    //   params.liquidityGaugeReward.rewardsDuration
    // );
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
