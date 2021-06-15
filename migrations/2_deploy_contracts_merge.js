const { BN, constants } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const Minter = artifacts.require("Minter");
const XBEInflation = artifacts.require("XBEInflation");
const GaugeController = artifacts.require("GaugeController");
const VeXBE = artifacts.require("VeXBE");
const LiquidityGaugeReward = artifacts.require("LiquidityGaugeReward");
const Voting = artifacts.require("Voting");
const StakingRewards = artifacts.require("StakingRewards");
const BonusCampaign = artifacts.require("BonusCampaign");
const MockToken = artifacts.require("MockToken");

let fs = require('fs');
const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days("30").mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));
const ONE = new BN('1');
const ZERO = new BN('0');
//

let mockXBE;
let mockCRV;
let vaultWithXBExCRVStrategy;
let xbeInflation;
let bonusCampaign;
let minter;
let gaugeController;
let veXBE;
let voting;
let stakingRewards;
let liquidityGaugeReward;

const saveAddresses = () => {
  let jsonAddressData = JSON.stringify({
    mockXBE: mockXBE.address,
    mockCRV: mockCRV.address,
    vaultWithXBExCRVStrategy: vaultWithXBExCRVStrategy.address,
    xbeInflation: xbeInflation.address,
    bonusCampaign: bonusCampaign.address,
    minter: minter.address,
    gaugeController: gaugeController.address,
    veXBE: veXBE.address,
    voting: voting.address,
    stakingRewards: stakingRewards.address,
    liquidityGaugeReward: liquidityGaugeReward.address
  });
  fs.writeFileSync("addresses.json", jsonAddressData);
};

const getSavedAddress = (key) => {
  addressesJson = fs.readFileSync("addresses.json");
  return JSON.parse(addressesJson)[key];
};

const deployContracts = async (deployer, params, owner) => {
  mockXBE = await deployer.deploy(
      MockToken,
      "Mock XBE",
      "mXBE",
      params.mockTokens.mockedTotalSupplyXBE,
      {from: owner}
  );

  mockCRV = await deployer.deploy(
      MockToken,
      "Mock CRV",
      "mCRV",
      params.mockTokens.mockedTotalSupplyCRV,
      {from: owner}
  );

  vaultWithXBExCRVStrategy = await deployer.deploy(
      MockToken,
      "Mock Vault LP Token",
      "mLP",
      params.mockTokens.mockedTotalSupplyXBE,
      {from: owner}
  );

  // deploy bonus campaign xbeinflation
  xbeInflation = await deployer.deploy(XBEInflation, {from: owner});

  // deploy bonus campaign
  bonusCampaign = await deployer.deploy(BonusCampaign, {from: owner});

  // deploy minter
  minter = await deployer.deploy(Minter, {from: owner});

  // deploy gauge controller
  gaugeController = await deployer.deploy(GaugeController, {from: owner});

  // deploy voting escrow
  veXBE = await deployer.deploy(VeXBE, {from: owner});

  // deploy voting
  voting = await deployer.deploy(Voting, {from: owner});

  // deploy staking rewards
  stakingRewards = await deployer.deploy(StakingRewards, {from: owner});

  //deploy liquidity gauge
  liquidityGaugeReward = await deployer.deploy(LiquidityGaugeReward, {from: owner});

  saveAddresses();

};

const distributeTokens = async (params, alice, bob, owner) => {

  mockXBE = await MockToken.at(getSavedAddress("mockXBE"));
  mockCRV = await MockToken.at(getSavedAddress("mockCRV"));
  vaultWithXBExCRVStrategy = await MockToken.at(getSavedAddress("vaultWithXBExCRVStrategy"));

  // LP, XBE and CRV to alice
  await mockXBE.approve(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockCRV.approve(alice, params.mockTokens.mockedAmountCRV, {
    from: owner,
  });
  await mockCRV.transfer(alice, params.mockTokens.mockedAmountCRV, {
    from: owner,
  });
  await vaultWithXBExCRVStrategy.approve(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await vaultWithXBExCRVStrategy.transfer(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });

  // LP, XBE and CRV to bob
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
  await vaultWithXBExCRVStrategy.approve(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await vaultWithXBExCRVStrategy.transfer(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
};

const configureContracts = async (params, owner) => {

  mockXBE = await MockToken.at(getSavedAddress("mockXBE"));
  mockCRV = await MockToken.at(getSavedAddress("mockCRV"));
  vaultWithXBExCRVStrategy = await MockToken.at(getSavedAddress("vaultWithXBExCRVStrategy"));
  xbeInflation = await XBEInflation.at(getSavedAddress("xbeInflation"));
  bonusCampaign = await BonusCampaign.at(getSavedAddress("bonusCampaign"));
  minter = await Minter.at(getSavedAddress("minter"));
  gaugeController = await GaugeController.at(getSavedAddress("gaugeController"));
  veXBE = await VeXBE.at(getSavedAddress("veXBE"));
  voting = await Voting.at(getSavedAddress("voting"));
  stakingRewards = await StakingRewards.at(getSavedAddress("stakingRewards"));
  liquidityGaugeReward = await LiquidityGaugeReward.at(getSavedAddress("liquidityGaugeReward"));

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
    params.bonusCampaign.rewardsDuration,
    params.bonusCampaign.mintTime,
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
    vaultWithXBExCRVStrategy.address,
    params.liquidityGaugeReward.rewardsDuration
  );

  await liquidityGaugeReward.initialize(
    vaultWithXBExCRVStrategy.address,
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
};

module.exports = function (deployer, network, accounts) {

  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  const params = {
    liquidityGaugeReward: {
      boostWarmup: ZERO, // new BN('2').mul(new BN('7')).mul(new BN('86400')),
      rewardsDuration: days("365"),
      typeName: "standard",
      startingTypeWeight: new BN("10000").div(new BN("8")), // 100% in base points divided by 8 different gauges
      startingGaugeWeight: new BN("10000").div(new BN("8"))
    },
    bonusCampaign: {
      rewardsDuration: months("23"),
      emission: ether("5000"),
      mintTime: new BN("1620894602"), // 13 may 2021 11:40
    },
    mockTokens: {
      mockedTotalSupplyXBE: ether("2000"),
      mockedTotalSupplyCRV: ether("2000"),
      mockedAmountXBE: ether("100"),
      mockedAmountCRV: ether("100")
    },
    xbeinflation: {
      initialSupply: new BN("5000"),
      initialRate: new BN("274815283").mul(MULTIPLIER).div(YEAR), // new BN('10000').mul(MULTIPLIER).div(YEAR)
      rateReductionTime: YEAR,
      rateReductionCoefficient: new BN("1189207115002721024"), // new BN('10').mul(MULTIPLIER)
      rateDenominator: MULTIPLIER,
      inflationDelay: new BN("86400")
    },
    voting: {
      supportRequiredPct: new BN("5100"),
      minAcceptQuorumPct: new BN("3000"),
      voteTime: new BN("1000000")
    },
  };

  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network === 'development' || network.startsWith('rinkeby')) {
      if (network === "rinkeby_deploy") {
        await deployContracts(deployer, params, owner);
      } else if (network === "rinkeby_tokens") {
        await distributeTokens(params, alice, bob, owner);
      } else if (network === "rinkeby_configure") {
        await configureContracts(params, owner);
      } else {
        await deployContracts(deployer, params, owner);
        await distributeTokens(params, alice, bob, owner);
        await configureContracts(params, owner);
      }
    }
  });
}
