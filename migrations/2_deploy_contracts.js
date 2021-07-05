const { BN, constants, time } = require('@openzeppelin/test-helpers');
const { accounts, contract } = require('@openzeppelin/test-environment');
const { ZERO_ADDRESS } = constants;

const fs = require('fs');
const distro = require('../../curve-convex/distro.json');

const XBEInflation = contract.fromArtifact('XBEInflation');
const VeXBE = contract.fromArtifact('VeXBE');
const Voting = contract.fromArtifact('Voting');
const HiveStrategy = contract.fromArtifact('HiveStrategy');
const HiveVault = contract.fromArtifact('HiveVault');
// const StakingRewards = artifacts.require('StakingRewards');
const BonusCampaign = contract.fromArtifact('BonusCampaign');
const ReferralProgram = contract.fromArtifact('ReferralProgram');

const MockToken = contract.fromArtifact('MockToken');

const Treasury = contract.fromArtifact('Treasury');
// const XBE = artifacts.require('XBE');
const TokenWrapper = contract.fromArtifact('TokenWrapper');
const Registry = contract.fromArtifact('Registry');
const Controller = contract.fromArtifact('Controller');
const ConsumerEURxbVault = contract.fromArtifact('ConsumerEURxbVault');
const InstitutionalEURxbVault = contract.fromArtifact('InstitutionalEURxbVault');
const UnwrappedToWrappedTokenConverter = contract.fromArtifact('UnwrappedToWrappedTokenConverter');
const WrappedToUnwrappedTokenConverter = contract.fromArtifact('WrappedToUnwrappedTokenConverter');
const InstitutionalEURxbStrategy = contract.fromArtifact('InstitutionalEURxbStrategy');
const ConsumerEURxbStrategy = contract.fromArtifact('ConsumerEURxbStrategy');
const IAddressProvider = contract.fromArtifact('IAddressProvider');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));
const ONE = new BN('1');
const ZERO = new BN('0');
//

let mockXBE;
let xbeInflation;
let bonusCampaign;
let veXBE;
let voting;
let hiveStrategy;
let controller;
let treasury;
let hiveVault;
let referralProgram;
let registry;

const saveAddresses = () => {
  const jsonAddressData = JSON.stringify({
    mockXBE: mockXBE.address,
    xbeInflation: xbeInflation.address,
    bonusCampaign: bonusCampaign.address,
    veXBE: veXBE.address,
    voting: voting.address,
    hiveStrategy: hiveStrategy.address,
    hiveVault: hiveVault.address,
    referralProgram: referralProgram.address,
    registry: registry.address,
    treasury: treasury.address,
    controller: controller.address,
  });
  fs.writeFileSync('addresses.json', jsonAddressData);
};

const getSavedAddress = (key) => {
  addressesJson = fs.readFileSync('addresses.json');
  return JSON.parse(addressesJson)[key];
};

const deployContracts = async (deployer, params, owner) => {
  registry = await deployer.deploy(
    Registry,
    { from: owner },
  );

  referralProgram = await deployer.deploy(
    ReferralProgram,
    { from: owner },
  );

  treasury = await deployer.deploy(
    Treasury,
    { from: owner },
  );

  controller = await deployer.deploy(
    Controller,
    { from: owner },
  );

  hiveStrategy = await deployer.deploy(
    HiveStrategy,
    { from: owner },
  );

  hiveVault = await deployer.deploy(
    HiveVault,
    { from: owner },
  );
  mockXBE = await deployer.deploy(
    MockToken,
    'Mock XBE',
    'mXBE',
    params.mockTokens.mockedTotalSupplyXBE,
    { from: owner },
  );

  // deploy bonus campaign xbeinflation
  xbeInflation = await deployer.deploy(XBEInflation, { from: owner });

  // deploy bonus campaign
  bonusCampaign = await deployer.deploy(BonusCampaign, { from: owner });

  // deploy voting escrow
  veXBE = await deployer.deploy(VeXBE, { from: owner });

  // deploy voting
  voting = await deployer.deploy(Voting, { from: owner });

  saveAddresses();
};

const distributeTokens = async (params, alice, bob, owner) => {
  mockXBE = await MockToken.at(getSavedAddress('mockXBE'));

  // LP, XBE and CRV to alice
  await mockXBE.approve(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });

  // LP, XBE and CRV to bob
  await mockXBE.approve(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
};

const configureContracts = async (params, owner) => {

  const { dependentsAddresses } = params;

  mockXBE = await MockToken.at(getSavedAddress('mockXBE'));
  xbeInflation = await XBEInflation.at(getSavedAddress('xbeInflation'));
  bonusCampaign = await BonusCampaign.at(getSavedAddress('bonusCampaign'));
  veXBE = await VeXBE.at(getSavedAddress('veXBE'));
  voting = await Voting.at(getSavedAddress('voting'));

  referralProgram = await ReferralProgram.at(getSavedAddress('referralProgram'));
  registry = await Registry.at(getSavedAddress('registry'));
  treasury = await Treasury.at(getSavedAddress('treasury'));
  controller = await Controller.at(getSavedAddress('controller'));
  hiveVault = await HiveVault.at(getSavedAddress('hiveVault'));
  hiveStrategy = await HiveStrategy.at(getSavedAddress('hiveStrategy'));

  const now = await time.latest();

  await referralProgram.configure(
    [mockXBE.address, dependentsAddresses.convex.cvx, dependentsAddresses.convex.cvxCrv],
    treasury.address,
    { from: owner }
  );

  await registry.configure(
    owner,
    { from: owner }
  );

  await treasury.configure(
    voting.address,
    voting.address,
    mockXBE.address,
    dependentsAddresses.uniswap_router_02,
    dependentsAddresses.uniswap_factory,
    params.treasury.slippageTolerance,
    now.add(params.treasury.swapDeadline),
    { from: owner }
  );

  await controller.configure(
    treasury.address,
    owner,
    owner,
    { from: owner }
  );

  await controller.setVault(
    dependentsAddresses.convex.pools[0].lptoken,
    hiveVault.address,
    { from: owner }
  );

  await controller.setApprovedStrategy(
    dependentsAddresses.convex.pools[0].lptoken,
    hiveStrategy.address,
    true,
    { from: owner }
  );

  await controller.setStrategy(
    dependentsAddresses.convex.pools[0].lptoken,
    hiveStrategy.address,
    { from: owner }
  );

  // "0x252c40Ba1295277F993d91F649644C4eF72C708D"
  console.log(dependentsAddresses);

  await hiveStrategy.configure(
    dependentsAddresses.curve.address_provider,
    dependentsAddresses.convex.pools[0].lptoken,
    controller.address,
    hiveVault.address,
    owner,
    [
      dependentsAddresses.curve.pools[0].swap_address,
      dependentsAddresses.curve.pools[0].lp_token_address,
      dependentsAddresses.convex.pools[0].crvRewards,
      dependentsAddresses.convex.pools[0].token,
      dependentsAddresses.convex.booster,
      dependentsAddresses.curve.pools[0].coins.length
    ],
    { from: owner }
  );

  const mainRegistryAddress = await (await IAddressProvider.at(dependentsAddresses.curve.address_provider))
    .get_registry({ from: owner });

  console.log(mainRegistryAddress);
  await hiveStrategy.setMainRegistry(
    mainRegistryAddress,
    { from: owner }
  );


  await hiveVault.configure(
    dependentsAddresses.convex.pools[0].lptoken,
    controller.address,
    owner,
    referralProgram.address,
    treasury.address,
    { from: owner }
  );

  await xbeInflation.configure(
    mockXBE.address,
    params.xbeinflation.initialSupply,
    params.xbeinflation.initialRate,
    params.xbeinflation.rateReductionTime,
    params.xbeinflation.rateReductionCoefficient,
    params.xbeinflation.rateDenominator,
    params.xbeinflation.inflationDelay,
    { from: owner }
  );

  await bonusCampaign.configure(
    mockXBE.address,
    veXBE.address,
    now.add(params.bonusCampaign.startMintTime),
    now.add(params.bonusCampaign.stopRegisterTime),
    params.bonusCampaign.rewardsDuration,
    params.bonusCampaign.emission,
    { from: owner }
  );

  await veXBE.configure(
    mockXBE.address,
    'Voting Escrowed XBE',
    'veXBE',
    '0.0.1',
    { from: owner }
  );

  await voting.initialize(
    veXBE.address,
    params.voting.supportRequiredPct,
    params.voting.minAcceptQuorumPct,
    params.voting.voteTime,
    { from: owner }
  );
};

module.exports = function (deployer, network) {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let params = {
    treasury: {
      slippageTolerance: new BN('3'),
      swapDeadline: new BN('300'),
    },
    bonusCampaign: {
      rewardsDuration: months('23'),
      emission: ether('5000'),
      stopRegisterTime: days('30'),
      startMintTime: new BN('0'),
    },
    mockTokens: {
      mockedTotalSupplyXBE: ether('2000'),
      mockedTotalSupplyCRV: ether('2000'),
      mockedAmountXBE: ether('100'),
      mockedAmountCRV: ether('100'),
    },
    xbeinflation: {
      initialSupply: new BN('5000'),
      initialRate: new BN('274815283').mul(MULTIPLIER).div(YEAR), // new BN('10000').mul(MULTIPLIER).div(YEAR)
      rateReductionTime: YEAR,
      rateReductionCoefficient: new BN('1189207115002721024'), // new BN('10').mul(MULTIPLIER)
      rateDenominator: MULTIPLIER,
      inflationDelay: new BN('86400'),
    },
    voting: {
      supportRequiredPct: new BN('5100'),
      minAcceptQuorumPct: new BN('3000'),
      voteTime: new BN('1000000'),
    },
    treasury: {
      slippageTolerance: new BN('9500'),
      swapDeadline: days('1')
    }
  };

  deployer.then(async () => {

    const dependentsAddresses = distro.rinkeby;
    params = { dependentsAddresses, ...params };

    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network.startsWith('rinkeby')) {
      if (network === 'rinkeby_deploy') {

        await deployContracts(deployer, params, owner);

      } else if (network === 'rinkeby_tokens') {

        await distributeTokens(params, alice, bob, owner);

      } else if (network === 'rinkeby_configure') {

        await configureContracts(params, owner);

      } else if (network === 'rinkeby_all_with_save') {

        await deployContracts(deployer, params, owner);
        await distributeTokens(params, alice, bob, owner);
        await configureContracts(params, owner);

      } else if (network === 'rinkeby_vaults') {

        await deployVaults(params);

      } else {
        console.error(`Unsupported network: ${network}`);
      }

    } else if (network === 'development' || network === "mainnet_fork") {

      await deployContracts(deployer, params, owner);
      await distributeTokens(params, alice, bob, owner);
      await configureContracts(params, owner);

    } else if (network === 'mainnet') {

      await deployVaultsToMainnet();

    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
