const {
  BN,
  ether,
  expectRevert,
  constants, time,
} = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require('./common.js');

const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));

const VeXBE = artifacts.require('VeXBE');
const Voting = artifacts.require('Voting');
const StakingRewards = artifacts.require('StakingRewards');
const BonusCampaign = artifacts.require('BonusCampaign');
const MockToken = artifacts.require('MockToken');
const SimpleXBEInflation = artifacts.require('SimpleXBEInflation');

const defaultParams = {
  bonusCampaign: {
    rewardsDuration: months('23'),
    emission: ether('5000'),
    mintTime: ZERO,
    stopRegisterTime: months('1'),
  },
  mockTokens: {
    mockedTotalSupplyXBE: ether('1000'),
    mockedTotalSupplyCX: ether('1000'),
    mockedAmountXBE: ether('100'),
    mockedAmountCX: ether('100'),
  },
  simpleXBEInflation: {
    targetMinted: ether('5000'),
    periodsCount: new BN('52'),
    periodDuration: new BN('604800'),
  },
  voting: {
    supportRequiredPct: new BN('5100'),
    minAcceptQuorumPct: new BN('3000'),
    voteTime: new BN('1000000'),
  },
};

const deployStrategyInfrastructure = (
  owner,
  alice,
  bob,
  minter,
  mockXBE,
  mockCX,
  params,
) => {
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;

  const proceed = async () => {
    console.log('owner', owner);
    xbeInflation = await SimpleXBEInflation.new({ from: owner });

    // deploy bonus campaign
    bonusCampaign = await BonusCampaign.new({ from: owner });

    // deploy voting escrow
    veXBE = await VeXBE.new({ from: owner });

    // deploy voting
    voting = await Voting.new({ from: owner });

    return [
      xbeInflation,
      bonusCampaign,
      veXBE,
      voting,
    ];
  };

  const configure = async () => {
    await xbeInflation.configure(
      mockXBE.address,
      params.simpleXBEInflation.targetMinted,
      params.simpleXBEInflation.periodsCount,
      params.simpleXBEInflation.periodDuration,
      { from: owner },
    );

    const configureTime = await time.latest();
    await bonusCampaign.configure(
      mockXBE.address,
      veXBE.address,
      configureTime.add(params.bonusCampaign.mintTime),
      configureTime.add(params.bonusCampaign.stopRegisterTime),
      params.bonusCampaign.rewardsDuration,
      params.bonusCampaign.emission,
      { from: owner },
    );

    await veXBE.configure(
      mockXBE.address,
      'Voting Escrowed XBE',
      'veXBE',
      '0.0.1',
      { from: owner },
    );

    await voting.initialize(
      veXBE.address,
      params.voting.supportRequiredPct,
      params.voting.minAcceptQuorumPct,
      params.voting.voteTime,
      { from: owner },
    );
  };

  return {
    proceed,
    configure,
  };
};

const getMockXBEandCX = async (owner, alice, bob, params) => {
  const mockXBE = await getMockTokenPrepared(
    alice,
    params.mockTokens.mockedAmountXBE,
    params.mockTokens.mockedTotalSupplyXBE,
    owner,
  );

  const mockCX = await getMockTokenPrepared(
    alice,
    params.mockTokens.mockedAmountCX,
    params.mockTokens.mockedTotalSupplyCX,
    owner,
  );

  await mockXBE.approve(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });

  await mockCX.approve(bob, params.mockTokens.mockedAmountCX, {
    from: owner,
  });
  await mockCX.transfer(bob, params.mockTokens.mockedAmountCX, {
    from: owner,
  });
  return [mockXBE, mockCX];
};

const beforeEachWithSpecificDeploymentParams = async (
  owner,
  alice,
  bob,
  minter,
  middleware,
) => {
  const vaultWithXBExCXStrategy = await getMockTokenPrepared(
    alice,
    ether('100'),
    ether('1000'),
    owner,
  );
  await vaultWithXBExCXStrategy.approve(bob, ether('100'), { from: owner });
  await vaultWithXBExCXStrategy.transfer(bob, ether('100'), { from: owner });
  defaultParams.vaultWithXBExCXStrategyAddress = vaultWithXBExCXStrategy.address;

  const [mockXBE, mockCX] = await getMockXBEandCX(owner, alice, bob, defaultParams);

  if (middleware) {
    await middleware();
  }

  let deployment = deployStrategyInfrastructure(
    owner,
    alice,
    bob,
    minter,
    mockXBE,
    mockCX,
    defaultParams,
  );

  const result = await deployment.proceed();
  await deployment.configure();
  return [vaultWithXBExCXStrategy, mockXBE, mockCX, ...result];
};

module.exports = {
  deployStrategyInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  months,
  defaultParams,
  getMockXBEandCX,
  beforeEachWithSpecificDeploymentParams,
};
