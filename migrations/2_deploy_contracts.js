const { BN, constants, time } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const fs = require('fs');
const distro = require('../distro.json');
const testnet_distro = require('../../curve-convex/rinkeby_distro.json');

const XBEInflation = artifacts.require('XBEInflation');
const VeXBE = artifacts.require('VeXBE');

const Voting = artifacts.require('Voting');

const HiveStrategy = artifacts.require('HiveStrategy');
const HiveVault = artifacts.require('HiveVault');

const SushiStrategy = artifacts.require('SushiStrategy');
const SushiVault = artifacts.require('SushiVault');

const CVXStrategy = artifacts.require('CVXStrategy');
const CVXVault = artifacts.require('CVXVault');

const CvxCrvStrategy = artifacts.require('CvxCrvStrategy');
const CvxCrvVault = artifacts.require('CvxCrvVault');

const BonusCampaign = artifacts.require('BonusCampaign');
const ReferralProgram = artifacts.require('ReferralProgram');

const MockToken = artifacts.require('MockToken');

const Treasury = artifacts.require('Treasury');
const TokenWrapper = artifacts.require('TokenWrapper');
const Registry = artifacts.require('Registry');
const Controller = artifacts.require('Controller');

const ConsumerEURxbVault = artifacts.require('ConsumerEURxbVault');
const ConsumerEURxbStrategy = artifacts.require('ConsumerEURxbStrategy');

const InstitutionalEURxbVault = artifacts.require('InstitutionalEURxbVault');
const InstitutionalEURxbStrategy = artifacts.require('InstitutionalEURxbStrategy');

const UnwrappedToWrappedTokenConverter = artifacts.require('UnwrappedToWrappedTokenConverter');
const WrappedToUnwrappedTokenConverter = artifacts.require('WrappedToUnwrappedTokenConverter');

const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory');
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));
const ONE = new BN('1');
const ZERO = new BN('0');

const SUSHISWAP_ROUTER_ADDRESS = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const SUSHISWAP_FACTORY_ADDRESS = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";

let mockXBE;
let mockLpSushi;
let mockTokenForSushiPair;

let xbeInflation;
let bonusCampaign;
let veXBE;
let controller;
let treasury;
let referralProgram;
let registry;

let voting;

let hiveStrategy;
let hiveVault;

let sushiStrategy;
let sushiVault;

let cvxStrategy;
let cvxVault;

let cvxCrvStrategy;
let cvxCrvVault;

const saveAddresses = () => {
  const jsonAddressData = JSON.stringify({
    mockXBE: mockXBE.address,
    mockLpSushi: mockLpSushi.address,
    mockTokenForSushiPair: mockTokenForSushiPair.address,
    xbeInflation: xbeInflation.address,
    bonusCampaign: bonusCampaign.address,
    veXBE: veXBE.address,
    voting: voting.address,
    referralProgram: referralProgram.address,
    registry: registry.address,
    treasury: treasury.address,
    controller: controller.address,
    hiveStrategy: hiveStrategy.address,
    hiveVault: hiveVault.address,
    sushiStrategy: sushiStrategy.address,
    sushiVault: sushiVault.address,
    cvxStrategy: cvxStrategy.address,
    cvxVault: cvxVault.address,
    cvxCrvStrategy: cvxCrvStrategy.address,
    cvxCrvVault: cvxCrvVault.address
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

  const _strategiesAndVaults = [
    HiveStrategy,
    CVXStrategy,
    CvxCrvStrategy,
    SushiStrategy,
    HiveVault,
    CVXVault,
    CvxCrvVault,
    SushiVault
  ];

  const deployStrategiesAndVaults = async (strategiesAndVaults) => {
      const result = [];
      for (let i = 0; i < strategiesAndVaults.length; i++) {
          result.push(
              deployer.deploy(
                strategiesAndVaults[i],
                { from: owner },
              )
          );
      }
      return result;
  };
  [
      hiveStrategy,
      cvxStrategy,
      cvxCrvStrategy,
      sushiStrategy,
      hiveVault,
      cvxVault,
      cvxCrvVault,
      sushiVault
  ] = await deployStrategiesAndVaults(_strategiesAndVaults);

  mockXBE = await deployer.deploy(
    MockToken,
    'Mock XBE',
    'mXBE',
    params.mockTokens.mockedTotalSupplyXBE,
    { from: owner },
  );

  mockTokenForSushiPair = await deployer.deploy(
    MockToken,
    'Mock Token for Sushi Pair',
    'mTSP',
    params.mockTokens.mockedTotalSupplyOtherToken,
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

  const sushiSwapRouter = await IUniswapV2Router02.at(SUSHISWAP_ROUTER_ADDRESS);
  const sushiSwapFactory = await IUniswapV2Factory.at(SUSHISWAP_FACTORY_ADDRESS);

  await mockXBE.approve(
      sushiSwapRouter.address,
      params.sushiswapPair.xbeAmountForPair,
      {from: owner}
  );
  await mockTokenForSushiPair.approve(
      sushiSwapRouter.address,
      params.sushiswapPair.mockTokenAmountForPair,
      {from: owner}
  );
  await sushiSwapRouter.addLiquidity(
    mockXBE.address,
    mockTokenForSushiPair.address,
    params.sushiswapPair.xbeAmountForPair,
    params.sushiswapPair.mockTokenAmountForPair,
    params.sushiswapPair.xbeAmountForPair,
    params.sushiswapPair.mockTokenAmountForPair,
    owner,
    now.add(new BN('3600'))
  );

  mockLpSushi = await IUniswapV2Pair.at(
      sushiSwapFactory.getPair(
          mockXBE.address,
          mockTokenForSushiPair.address
      )
  );

  saveAddresses();
};

const distributeTokens = async (params, alice, bob, owner) => {
  mockXBE = await MockToken.at(getSavedAddress('mockXBE'));
  mockTokenForSushiPair = await MockToken.at(getSavedAddress('mockTokenForSushiPair'));

  // XBE to alice
  await mockXBE.approve(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });

  // XBE to bob
  await mockXBE.approve(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });

  // mock token for sushi pair to alice
  await mockTokenForSushiPair.approve(alice, params.mockTokens.mockedAmountOtherToken, {
    from: owner,
  });
  await mockTokenForSushiPair.transfer(alice, params.mockTokens.mockedAmountOtherToken, {
    from: owner,
  });

  // mock token for sushi pair to bob
  await mockTokenForSushiPair.approve(bob, params.mockTokens.mockedAmountOtherToken, {
    from: owner,
  });
  await mockTokenForSushiPair.transfer(bob, params.mockTokens.mockedAmountOtherToken, {
    from: owner,
  });

};

const configureContracts = async (params, owner) => {
  const { dependentsAddresses } = params;

  mockXBE = await MockToken.at(getSavedAddress('mockXBE'));
  xbeInflation = await XBEInflation.at(getSavedAddress('xbeInflation'));
  bonusCampaign = await BonusCampaign.at(getSavedAddress('bonusCampaign'));
  veXBE = await VeXBE.at(getSavedAddress('veXBE'));

  referralProgram = await ReferralProgram.at(getSavedAddress('referralProgram'));
  registry = await Registry.at(getSavedAddress('registry'));
  treasury = await Treasury.at(getSavedAddress('treasury'));
  controller = await Controller.at(getSavedAddress('controller'));

  voting = await Voting.at(getSavedAddress('voting'));

  hiveVault = await HiveVault.at(getSavedAddress('hiveVault'));
  hiveStrategy = await HiveStrategy.at(getSavedAddress('hiveStrategy'));

  cvxCrvVault = await HiveVault.at(getSavedAddress('cvxCrvVault'));
  cvxCrvStrategy = await HiveStrategy.at(getSavedAddress('cvxCrvStrategy'));

  cvxVault = await HiveVault.at(getSavedAddress('cvxVault'));
  cvxStrategy = await HiveStrategy.at(getSavedAddress('cvxStrategy'));

  sushiVault = await HiveVault.at(getSavedAddress('sushiVault'));
  sushiStrategy = await HiveStrategy.at(getSavedAddress('sushiStrategy'));

  const now = await time.latest();

  console.log('Starting configuration...');

  await referralProgram.configure(
    [mockXBE.address, dependentsAddresses.convex.cvx, dependentsAddresses.convex.cvxCrv],
    treasury.address,
    { from: owner },
  );

  console.log('ReferralProgram configured...');

  await registry.configure(
    owner,
    { from: owner },
  );

  console.log('Registry configured...');

  await treasury.configure(
    voting.address,
    voting.address,
    mockXBE.address,
    dependentsAddresses.uniswap_router_02,
    dependentsAddresses.uniswap_factory,
    params.treasury.slippageTolerance,
    now.add(params.treasury.swapDeadline),
    { from: owner },
  );

  console.log('Treasury configured...');

  await controller.configure(
    treasury.address,
    owner,
    owner,
    { from: owner },
  );

  console.log('Controller configured...');

  await controller.setVault(
    dependentsAddresses.convex.pools[0].lptoken,
    hiveVault.address,
    { from: owner },
  );

  console.log('Controller: vault added...');

  await controller.setApprovedStrategy(
    dependentsAddresses.convex.pools[0].lptoken,
    hiveStrategy.address,
    true,
    { from: owner },
  );

  console.log('Controller: strategy approved...');

  await controller.setStrategy(
    dependentsAddresses.convex.pools[0].lptoken,
    hiveStrategy.address,
    { from: owner },
  );

  console.log('Controller: strategy added...');

  await hiveStrategy.configure(
    dependentsAddresses.convex.pools[0].lptoken,
    controller.address,
    hiveVault.address,
    owner,
    mockXBE.address,
    voting.address,
    [
      dependentsAddresses.curve.pool_data.mock_pool.lp_token_address,
      dependentsAddresses.convex.pools[0].crvRewards,
      dependentsAddresses.convex.cvxRewards,
      dependentsAddresses.convex.booster,
      ZERO,
      dependentsAddresses.curve.CRV,
      dependentsAddresses.convex.cvx
    ],
    { from: owner },
  );
  console.log('HiveStrategy: configured');

  const _vaults = [
      [hiveVault, dependentsAddresses.convex.pools[0].lptoken]
      [cvxVault, dependentsAddresses.convex.cvx]
      [cvxCrvVault, dependentsAddresses.convex.cvxCrv]
      [sushiVault, mockLpSushi.address]
  ];

  for (let i = 0; i < _vaults.length; i++) {
      await _vaults[i][0].configure(
        _vaults[i][1],
        controller.address,
        owner,
        referralProgram.address,
        treasury.address,
        { from: owner },
      );
      console.log(`${_vaults[i].name}: configured`);
  }

  await xbeInflation.configure(
    mockXBE.address,
    params.xbeinflation.initialSupply,
    params.xbeinflation.initialRate,
    params.xbeinflation.rateReductionTime,
    params.xbeinflation.rateReductionCoefficient,
    params.xbeinflation.rateDenominator,
    params.xbeinflation.inflationDelay,
    { from: owner },
  );

  console.log('XBEInflation: configured');

  await bonusCampaign.configure(
    mockXBE.address,
    veXBE.address,
    now.add(params.bonusCampaign.startMintTime),
    now.add(params.bonusCampaign.stopRegisterTime),
    params.bonusCampaign.rewardsDuration,
    params.bonusCampaign.emission,
    { from: owner },
  );

  console.log('BonusCampaign: configured');

  await veXBE.configure(
    mockXBE.address,
    'Voting Escrowed XBE',
    'veXBE',
    '0.0.1',
    { from: owner },
  );

  console.log('VeXBE: configured...');

  await voting.initialize(
    veXBE.address,
    params.voting.supportRequiredPct,
    params.voting.minAcceptQuorumPct,
    params.voting.voteTime,
    { from: owner },
  );

  console.log('Voting: configured...');
};

module.exports = function (deployer, network, accounts) {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let params = {
    sushiswapPair: {
        xbeAmountForPair: ether('2'),
        mockTokenAmountForPair: ether('3')
    },
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
      mockedTotalSupplyOtherToken: ether('2000'),
      mockedAmountXBE: ether('100'),
      mockedAmountOtherToken: ether('100'),
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
      swapDeadline: days('1'),
    },
  };

  deployer.then(async () => {
    let dependentsAddresses = distro.rinkeby;
    dependentsAddresses.curve.pools = Object.values(dependentsAddresses
      .curve.pool_data);
    params = { dependentsAddresses, ...params };

    if (network === 'test' || network === 'soliditycoverage') {
      const { exec } = require('child_process');
      exec('cd ../curve-convex && npm run deploy && npm run generate-distro && cd ../yeur', (error, stdout, stderr) => {
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        if (error !== null) {
          console.log(`exec error: ${error}`);
        }
      });
      await deployContracts(deployer, params, owner);
      await distributeTokens(params, alice, bob, owner);
      await configureContracts(params, owner);
    } else if (network.startsWith('rinkeby')) {
      if (network === 'rinkeby_deploy') {
        await deployContracts(deployer, params, owner);
      } else if (network === 'rinkeby_tokens') {
        await distributeTokens(params, alice, bob, owner);
      } else if (network === 'rinkeby_configure') {
        await configureContracts(params, owner);
      } else if (network === 'rinkeby_all_with_save') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = { dependentsAddresses, ...params };
        await deployContracts(deployer, params, owner);
        await distributeTokens(params, alice, bob, owner);
        await configureContracts(params, owner);
      } else if (network === 'rinkeby_conf') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = { dependentsAddresses, ...params };
        await configureContracts(params, owner);
      } else if (network === 'rinkeby_vaults') {
        await deployVaults(params);
      } else {
        console.error(`Unsupported network: ${network}`);
      }
    } else if (network === 'development' || network === 'mainnet_fork') {
      await deployContracts(deployer, params, owner);
      await distributeTokens(params, alice, bob, owner);
      await configureContracts(params, owner);
    } else if (network === 'mainnet') {
      // await deployVaultsToMainnet();
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
