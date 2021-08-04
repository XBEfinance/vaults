/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const { BN, constants, time } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const fs = require('fs');
const distro = require('../distro.json');
const testnet_distro = require('../../curve-convex/rinkeby_distro.json');

const Registrator = artifacts.require('LockSubscription');
const SimpleXbeInflation = artifacts.require('SimpleXBEInflation');
const VeXBE = artifacts.require('VeXBE');

const Voting = artifacts.require('Voting');
const VotingStakingRewards = artifacts.require('VotingStakingRewards');

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
const WETH9 = artifacts.require('WETH9');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));
const ONE = new BN('1');
const ZERO = new BN('0');

const addressStore = {
  rinkeby: {
    sushiswap: {
      router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    },
    weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    xbe: '0x8ce5F9558e3E0cd7dE8bE15a93DffABEC83E314e',
    mockLpSushi: '0xe4aAB3d3Fc1893D7e74AF2a11C69bfD5598632D1',
  },
  mainnet: {
    sushiswap: {
      sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      sushiswapFactory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    },
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    xbe: '',
    mockLpSushi: '',
  },
  deployed: {},
};

const sushiSwapAddresses = {
  rinkeby: {
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    sushiswapFactory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
  },
  mainnet: {
    sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    sushiswapFactory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
};

let mockXBE;
let mockLpSushi;
let mockTokenForSushiPair;
let weth9;

let xbeInflation;
let registrator;
let bonusCampaign;
let veXBE;
let controller;
let treasury;
let referralProgram;
let registry;

let voting;
let votingStakingRewards;

let hiveStrategy;
let hiveVault;

let sushiStrategy;
let sushiVault;

let cvxStrategy;
let cvxVault;

let cvxCrvStrategy;
let cvxCrvVault;

const saveItem = (item, value, data) => {
    if (typeof(value) !== 'undefined') {
        data[item] = value;
    }
};

const readItem = (itemName, data) => {
    if (data.has(itemName)) {
        return data[itemName];
    }
    return null;
};

// to minimize risk of making mistake in naming
const addrNames = {
    mockXBE: 'mockXBE',
    mockLpSushi: 'mockLpSushi',
    xbeInflation: 'xbeInflation',
    registrator: 'registrator',
    bonusCampaign: 'bonusCampaign',
    veXBE: 'veXBE',
    referralProgram: 'referralProgram',
    registry: 'registry',
    treasury: 'treasury',
    controller: 'controller',
    hiveStrategy: 'hiveStrategy',
    hiveVault: 'hiveVault',
    sushiStrategy: 'sushiStrategy',
    sushiVault: 'sushiVault',
    cvxStrategy: 'cvxStrategy',
    cvxVault: 'cvxVault',
    cvxCrvStrategy: 'cvxCrvStrategy',
    cvxCrvVault: 'cvxCrvVault',
    voting: 'voting',
    votingStakingRewards: 'votingStakingRewards',
};

const saveAddresses = () => {
  const jsonAddressData = JSON.stringify({
    mockXBE: mockXBE.address,
    mockLpSushi: mockLpSushi.address,
    xbeInflation: xbeInflation.address,
    registrator: registrator.address,
    bonusCampaign: bonusCampaign.address,
    veXBE: veXBE.address,
    voting: voting.address,
    votingStakingRewards: votingStakingRewards.address,

    // referralProgram: referralProgram.address,
    registry: registry.address,
    treasury: treasury.address,
    controller: controller.address,
    // hiveStrategy: hiveStrategy.address,
    // hiveVault: hiveVault.address,
    sushiStrategy: sushiStrategy.address,
    sushiVault: sushiVault.address,
    // cvxStrategy: cvxStrategy.address,
    // cvxVault: cvxVault.address,
    // cvxCrvStrategy: cvxCrvStrategy.address,
    // cvxCrvVault: cvxCrvVault.address,
  });
  fs.writeFileSync('addresses.json', jsonAddressData);
};
//const readJsonAddresses = () => {
//    addresses = {};
//
//    const data = JSON.parse(fs.readFileSync('addresses.json'));
//
//    addrNames.forEach((value, key) => {
//        data.has(key) {}
//    });
//
//};

const getSavedAddress = (key) => {
  const addressesJson = fs.readFileSync('addresses.json');
  return JSON.parse(addressesJson)[key];
};

function getNowBN() {
  return new BN(Date.now() / 1000);
}

const deployContracts = async (deployer, params, owner) => {
  const { sushiSwap } = params;
  const now = getNowBN();

  registry = await deployer.deploy(
    Registry,
    { from: owner },
  );

  // referralProgram = await deployer.deploy(
  //   ReferralProgram,
  //   { from: owner },
  // );

  treasury = await deployer.deploy(
    Treasury,
    { from: owner },
  );

  controller = await deployer.deploy(
    Controller,
    { from: owner },
  );

  const strategiesAndVaults = [
    // HiveStrategy,
    // CVXStrategy,
    // CvxCrvStrategy,
    SushiStrategy,
    // HiveVault,
    // CVXVault,
    // CvxCrvVault,
    SushiVault,
  ];

  const deployStrategiesAndVaults = async (items) => {
    const result = [];
    for (let i = 0; i < items.length; i += 1) {
      result.push(
        await deployer.deploy(
          items[i],
          { from: owner },
        ),
      );
    }

    return Promise.all(result);
  };

  [
    // hiveStrategy,
    // cvxStrategy,
    // cvxCrvStrategy,
    sushiStrategy,
    // hiveVault,
    // cvxVault,
    // cvxCrvVault,
    sushiVault,
  ] = await deployStrategiesAndVaults(strategiesAndVaults);
  // !-----------------------------------

//  mockXBE = await deployer.deploy(
//    MockToken,
//    'Mock XBE',
//    'mXBE',
//    params.mockTokens.mockedTotalSupplyXBE,
//    { from: owner },
//  );

    // use deployed instance
    mockXBE = await MockToken.at(addressStore.rinkeby.xbe);
    console.log('mockXBE acquired ', mockXBE.address);

  // get weth ad address
  weth9 = await WETH9.at(addressStore.rinkeby.weth);
  console.log('WETH acquired');
  let ownerEthBalance = await weth9.balanceOf(owner);
  if ((new BN(ownerEthBalance)).lt(ether('1'))) {
    await weth9.deposit({ from: owner, value: ether('1') });
    ownerEthBalance = await weth9.balanceOf(owner);
    console.log('WETH owner balance deposited, new balance: ', new BN(ownerEthBalance).toString());
  } else {
    console.log('owner eth balance is enough:', new BN(ownerEthBalance).toString(), 'no deposit required');
  }

  // deploy bonus campaign xbeinflation
  xbeInflation = await deployer.deploy(SimpleXbeInflation, { from: owner });

  registrator = await deployer.deploy(Registrator, { from: owner });

  // deploy bonus campaign
  bonusCampaign = await deployer.deploy(BonusCampaign, { from: owner });

  // deploy voting escrow
  veXBE = await deployer.deploy(VeXBE, { from: owner });

  const sushiSwapRouter = await IUniswapV2Router02.at(sushiSwap.sushiswapRouter);
  console.log('sushiSwapRouter address: ', sushiSwapRouter.address);
  const sushiSwapFactory = await IUniswapV2Factory.at(sushiSwap.sushiswapFactory);
  console.log('sushiSwapFactory address: ', sushiSwapFactory.address);

//  // enough for him
//  await mockXBE.mintSender(ether('1000'), {from: owner});

//// not required now
//  await mockXBE.approve(
//    sushiSwapRouter.address,
//    params.sushiswapPair.xbeAmountForPair,
//    { from: owner },
//  );

//// already enough
//  await weth9.approve(
//    sushiSwapRouter.address,
//    params.sushiswapPair.wethAmountForPair,
//    { from: owner },
//  );

//  // no need to add liquidity each time
//  await sushiSwapRouter.addLiquidity(
//    mockXBE.address,
//    weth9.address,
//    params.sushiswapPair.xbeAmountForPair,
//    params.sushiswapPair.wethAmountForPair,
//    params.sushiswapPair.xbeAmountForPair,
//    params.sushiswapPair.wethAmountForPair,
//    owner,
//    now.add(new BN('3600')),
//  );

// it is the same each time, bcause mockXBE & weth9 are fixed
  mockLpSushi = await IUniswapV2Pair.at(
    await sushiSwapFactory.getPair(
      mockXBE.address,
      weth9.address,
    ),
  );

//  mockLpSushi = await IUniswapV2Pair.at(addressStore.rinkeby.mockLpSushi);
  console.log('mockLpSushi address: ', mockLpSushi.address);

  // deploy voting
  voting = await deployer.deploy(Voting, { from: owner });
  // voting will be deployed separately
  votingStakingRewards = await deployer.deploy(VotingStakingRewards, { from: owner });

  saveAddresses();
};

const distributeTokens = async (params, alice, bob, owner) => {
  mockXBE = await MockToken.at(getSavedAddress('mockXBE'));
  // mockTokenForSushiPair = await MockToken.at(getSavedAddress('mockTokenForSushiPair'));

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

  // // mock token for sushi pair to alice
  // await mockTokenForSushiPair.approve(alice, params.mockTokens.mockedAmountOtherToken, {
  //   from: owner,
  // });
  // await mockTokenForSushiPair.transfer(alice, params.mockTokens.mockedAmountOtherToken, {
  //   from: owner,
  // });
  //
  // // mock token for sushi pair to bob
  // await mockTokenForSushiPair.approve(bob, params.mockTokens.mockedAmountOtherToken, {
  //   from: owner,
  // });
  // await mockTokenForSushiPair.transfer(bob, params.mockTokens.mockedAmountOtherToken, {
  //   from: owner,
  // });
};

const configureContracts = async (params, owner) => {
  const { dependentsAddresses, sushiSwap } = params;
  // const now = await time.latest();
  const now = getNowBN();

  mockXBE = await MockToken.at(getSavedAddress('mockXBE'));

  voting = await Voting.at(getSavedAddress('voting'));
  votingStakingRewards = await VotingStakingRewards.at(getSavedAddress('votingStakingRewards'));
  // bonusCampaign = await BonusCampaign.at(getSavedAddress('bonusCampaign'));
  registrator = await Registrator.at(getSavedAddress('registrator'));
  xbeInflation = await SimpleXbeInflation.at(getSavedAddress('xbeInflation'));

  bonusCampaign = await BonusCampaign.at(getSavedAddress('bonusCampaign'));
  veXBE = await VeXBE.at(getSavedAddress('veXBE'));
  //
  // referralProgram = await ReferralProgram.at(getSavedAddress('referralProgram'));
  registry = await Registry.at(getSavedAddress('registry'));
  treasury = await Treasury.at(getSavedAddress('treasury'));
  controller = await Controller.at(getSavedAddress('controller'));

  // hiveVault = await HiveVault.at(getSavedAddress('hiveVault'));
  // hiveStrategy = await HiveStrategy.at(getSavedAddress('hiveStrategy'));

  // cvxCrvVault = await CvxCrvVault.at(getSavedAddress('cvxCrvVault'));
  // cvxCrvStrategy = await CvxCrvStrategy.at(getSavedAddress('cvxCrvStrategy'));

  // cvxVault = await CVXVault.at(getSavedAddress('cvxVault'));
  // cvxStrategy = await CVXStrategy.at(getSavedAddress('cvxStrategy'));

  sushiVault = await SushiVault.at(getSavedAddress('sushiVault'));
  sushiStrategy = await SushiStrategy.at(getSavedAddress('sushiStrategy'));

  mockLpSushi = await IUniswapV2Pair.at(getSavedAddress('mockLpSushi'));

  const strategiesAndVaults = [
    // {
    //   name: 'hive',
    //   vault: hiveVault,
    //   strategy: hiveStrategy,
    //   strategyConfigArgs: [
    //     dependentsAddresses.convex.pools[0].lptoken, // _wantAddress,
    //     controller.address, // _controllerAddress,
    //     hiveVault.address, // _vaultAddress,
    //     owner, // _governance,
    //     mockXBE.address, // _tokenToAutostake,
    //     // voting.address,
    //     ZERO_ADDRESS, // _voting,
    //     // _poolSettings
    //     [
    //       dependentsAddresses.curve.pool_data.mock_pool.lp_token_address,
    //       dependentsAddresses.convex.pools[0].crvRewards,
    //       dependentsAddresses.convex.cvxRewards,
    //       dependentsAddresses.convex.booster,
    //       ZERO,
    //       dependentsAddresses.curve.CRV,
    //       dependentsAddresses.convex.cvx,
    //     ],
    //   ],
    //   token: dependentsAddresses.convex.pools[0].lptoken,
    // },
//     {
//       name: 'cvxCrv',
//       vault: cvxCrvVault,
//       strategy: cvxCrvStrategy,
//       strategyConfigArgs: [
//         dependentsAddresses.convex.cvxCrv, // _wantAddress,
//         controller.address, // _controllerAddress,
//         cvxCrvVault.address, // _vaultAddress,
//         owner, // _governance,
//         // voting.address,
//         ZERO_ADDRESS, // _voting,
//         // _poolSettings
//         [
//           dependentsAddresses.curve.pool_data.mock_pool.lp_token_address, // lpCurve
//           dependentsAddresses.convex.cvxCrvRewards, // cvxCRVRewards
//           dependentsAddresses.convex.crvDepositor, // crvDepositor
//           dependentsAddresses.convex.booster, // convexBooster
//           dependentsAddresses.convex.cvxCrv, // cvxCrvToken
//           dependentsAddresses.curve.CRV, // crvToken
//         ],
//       ],
//       vaultConfigArgs: [
//         dependentsAddresses.convex.cvxCrv, // _initialToken
//         controller.address, // _initialController
//         owner, // _governance
//         now.add(days('7')), // _rewardsDuration // TODO: to reconcile with customer
//         mockXBE.address, // tokenToAutostake,
//         votingStakingRewards.address, // votingStakingRewards,
//         true, // enableFees ? false
//         owner, // teamWallet ? address(0) ?
//         referralProgram.address, // _referralProgram
//         treasury.address, // _treasury
//         [ // _rewardTokens
//           dependentsAddresses.convex.cvxCrv, // ???????
//           mockXBE.address,
// //          dependentsAddresses.convex.cvxCrv, // ???????
//         ],
//         'CC', // _namePostfix
//         'CC', // _symbolPostfix
//       ],
//       token: dependentsAddresses.convex.cvxCrv,
//     },
    // {
    //   name: 'cvx',
    //   vault: cvxVault,
    //   strategy: cvxStrategy,
    //   strategyConfigArgs: [
    //     dependentsAddresses.convex.cvx, // _wantAddress,
    //     controller.address, // _controllerAddress,
    //     cvxVault.address, // _vaultAddress,
    //     owner, // _governance,
    //     // voting.address,
    //     ZERO_ADDRESS, // _voting,
    //     // _poolSettings
    //     [
    //       dependentsAddresses.convex.cvxRewards, // cvxRewards
    //       dependentsAddresses.convex.cvx, // cvxToken
    //       ZERO, // poolIndex
    //     ],

    //   ],
    //   token: dependentsAddresses.convex.cvx,
    // },
    {
      name: 'sushi',
      vault: sushiVault,
      strategy: sushiStrategy,
      strategyConfigArgs: [
        mockLpSushi.address, // _wantAddress,
        controller.address, // _controllerAddress,
        sushiVault.address, // _vaultAddress,
        owner, // _governance,
        // _poolSettings
        [
          mockLpSushi.address,
//          dependentsAddresses.convex.chef, // convexMasterChef
//          ZERO,
          dependentsAddresses.convex.cvx, // ???
        ],
      ],
      vaultConfigArgs: [
        mockLpSushi.address, // _initialToken
        controller.address, // _initialController
        owner, // _governance
        days('7'), // _rewardsDuration // TODO: to reconcile with customer
        mockXBE.address, // _tokenToAutostake
        votingStakingRewards.address, // _votingStakingRewards
        [ // _rewardTokens
//          dependentsAddresses.convex.cvx,
          mockXBE.address,
        ],
        'SH', // _namePostfix
        'SH', // _symbolPostfix
      ],
      token: mockLpSushi.address,
    },
  ];

   console.log('Starting configuration...');

  // await referralProgram.configure(
  //   [mockXBE.address, dependentsAddresses.convex.cvx, dependentsAddresses.convex.cvxCrv],
  //   treasury.address,
  //   { from: owner },
  // );

   // console.log('ReferralProgram configured...');

  await registry.configure(
    owner,
    { from: owner },
  );

   console.log('Registry configured...');

  await treasury.configure(
    voting.address,
    votingStakingRewards.address,
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

   console.log('Vaults and Strategies configuration...');
  for (const item of strategiesAndVaults) {
     console.log(`Configuring ${item.name}...`);

    await controller.setVault(
      item.token,
      item.vault.address,
      { from: owner },
    );

     console.log('Controller: vault added...');

    await controller.setApprovedStrategy(
      item.token,
      item.strategy.address,
      true,
      { from: owner },
    );

     console.log('Controller: strategy approved...');

    await controller.setStrategy(
      item.token,
      item.strategy.address,
      { from: owner },
    );

     console.log('Controller: strategy added...');

    await item.strategy.configure(
      ...item.strategyConfigArgs,
      { from: owner },
    );

     console.log(`${item.name}Strategy: configured`);

    // eslint-disable-next-line no-await-in-loop
    await item.vault.configure(
      ...item.vaultConfigArgs,
      { from: owner },
    );

    await item.vault.setRewardsDistribution(
        item.strategy.address,
        { from: owner },
    );

//    await item.vault.addFeeReceiver(
//      treasury.address,
//      new BN('10'),
//      [
//        mockXBE.address,
//      ],
//      true,
//      { from: owner },
//    );
    console.log(`${item.name}Vault: configured`);
  }

  xbeInflation.configure(
      mockXBE.address, // _token
      params.simpleXBEInflation.targetMinted,
      params.simpleXBEInflation.periodsCount,
      params.simpleXBEInflation.periodDuration,
      { from: owner },
    );

    await xbeInflation.addXBEReceiver(
      sushiStrategy.address,
      new BN('25'),
      { from: owner },
    );

    // instead of VotingStakingRewards: reward -> treasury -> votingStakingRewards
    await xbeInflation.addXBEReceiver(
      treasury.address,
      new BN('25'),
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

  await bonusCampaign.setRegistrator(registrator.address, { from: owner });

  await bonusCampaign.startMint({ from: owner });

   console.log('BonusCampaign: configured');

  await veXBE.configure(
    mockXBE.address,
    votingStakingRewards.address,
    registrator.address,
    'Voting Escrowed XBE',
    'veXBE',
    '0.0.1',
    { from: owner },
  );

  console.log('registrator address', registrator.address);
  await registrator.addSubscriber(bonusCampaign.address, { from: owner });
  await registrator.setEventSource(veXBE.address, { from: owner });

  console.log('VeXBE: configured...');

  await voting.initialize(
    veXBE.address,
    params.voting.supportRequiredPct,
    params.voting.minAcceptQuorumPct,
    params.voting.voteTime,
    { from: owner },
  );

  console.log('Voting: configured...');

  await votingStakingRewards.configure(
    treasury.address,
    mockXBE.address,
    mockXBE.address,
    months('23'),
    veXBE.address,
    voting.address,
    bonusCampaign.address, // works as a boost logic provider for now
    treasury.address, // to send remaining shares
    [],
  );

  console.log('VotingStakingRewards: configured...');
};

module.exports = function (deployer, network, accounts) {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let params = {
    sushiswapPair: {
      xbeAmountForPair: ether('2'),
      wethAmountForPair: ether('1'),
    },
    treasury: {
      slippageTolerance: new BN('3'),
      swapDeadline: new BN('300'),
    },
    bonusCampaign: {
      rewardsDuration: months('23'),
      emission: ether('5000'),
      stopRegisterTime: days('30'),
      startMintTime: ZERO, // months('18'),
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
    treasury: {
      slippageTolerance: new BN('9500'),
      swapDeadline: days('1'),
    },
  };

  deployer.then(async () => {
    let dependentsAddresses = distro.rinkeby;
    dependentsAddresses.curve.pools = Object.values(dependentsAddresses
      .curve.pool_data);
    params = {
      dependentsAddresses,
      sushiSwap: sushiSwapAddresses.rinkeby,
      ...params,
    };

    if (network === 'test' || network === 'soliditycoverage') {
      const { exec } = require('child_process');
      exec('cd ../curve-convex && npm run deploy && npm run generate-distro && cd ../yeur', (error, stdout, stderr) => {
        // console.log(`stdout: ${stdout}`);
        // console.log(`stderr: ${stderr}`);
        if (error !== null) {
          // console.log(`exec error: ${error}`);
        }
      });
      await deployContracts(deployer, params, owner);
      await distributeTokens(params, alice, bob, owner);
      await configureContracts(params, owner);
    } else if (network.startsWith('rinkeby')) {
      if (network === 'rinkeby_deploy') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = {
          dependentsAddresses,
          sushiSwap: sushiSwapAddresses.rinkeby,
          ...params,
        };
        await deployContracts(deployer, params, owner);
      } else if (network === 'rinkeby_deploy_voting') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = {
          dependentsAddresses,
          sushiSwap: sushiSwapAddresses.rinkeby,
          ...params,
        };
        // deploy voting
        voting = await deployer.deploy(Voting, { from: owner });
        // ...
      } else if (network === 'rinkeby_tokens') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = {
          dependentsAddresses,
          sushiSwap: sushiSwapAddresses.rinkeby,
          ...params,
        };
        await distributeTokens(params, alice, bob, owner);
      } else if (network === 'rinkeby_configure') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = {
          dependentsAddresses,
          sushiSwap: sushiSwapAddresses.rinkeby,
          ...params,
        };
        await configureContracts(params, owner);
      } else if (network === 'rinkeby_configure_voting') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = {
          dependentsAddresses,
          sushiSwap: sushiSwapAddresses.rinkeby,
          ...params,
        };

        voting = await Voting.at(getSavedAddress('voting'));
        votingStakingRewards = await VotingStakingRewards.at(getSavedAddress('votingStakingRewards'));
        bonusCampaign = await BonusCampaign.at(getSavedAddress('bonusCampaign'));
        veXBE = await VeXBE.at(getSavedAddress('veXBE'));
        mockXBE = await MockToken.at(getSavedAddress('mockXBE'));

        await voting.initialize(
          veXBE.address,
          params.voting.supportRequiredPct,
          params.voting.minAcceptQuorumPct,
          params.voting.voteTime,
          { from: owner },
        );
        console.log('Voting: configured...');

        await votingStakingRewards.configure(
          owner,
          mockXBE.address,
          mockXBE.address,
          months('23'),
          veXBE.address,
          voting.address,
          bonusCampaign.address,
          [],
        );
        console.log('VotingStakingRewards: configured...');
      } else if (network === 'rinkeby_all_with_save') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = {
          dependentsAddresses,
          sushiSwap: sushiSwapAddresses.rinkeby,
          ...params,
        };
        await deployContracts(deployer, params, owner);
        await distributeTokens(params, alice, bob, owner);
        await configureContracts(params, owner);
      } else if (network === 'rinkeby_conf') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        params = { dependentsAddresses, ...params };
        await configureContracts(params, owner);
      } else if (network === 'rinkeby_config_bonus_campaign') {
        bonusCampaign = await BonusCampaign.at('0xbce5A336944fa3c270A31bB7D148CbbF01E2C1bc');
        await bonusCampaign.configure(
          mockXBE.address,
          veXBE.address,
          now.add(params.bonusCampaign.startMintTime),
          now.add(params.bonusCampaign.stopRegisterTime),
          params.bonusCampaign.rewardsDuration,
          params.bonusCampaign.emission,
          { from: owner },
        );
      } else {
        console.error(`Unsupported network: ${network}`);
      }
    } else if (network === 'development' || network === 'mainnet_fork') {
      dependentsAddresses = testnet_distro.rinkeby;
      dependentsAddresses.curve.pools = Object.values(dependentsAddresses
        .curve.pool_data);
      params = {
        dependentsAddresses,
        sushiSwap: sushiSwapAddresses.rinkeby,
        ...params,
      };
      // await deployContracts(deployer, params, owner);
      // await distributeTokens(params, alice, bob, owner);
      // await configureContracts(params, owner);
    } else if (network === 'mainnet') {
      // await deployVaultsToMainnet();
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
