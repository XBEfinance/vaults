/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
const {
  BN,
  ether,
  expectRevert,
  constants,
  time,
} = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require('./common');

const distro = require('../../../distro.json');

const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));

const XBEInflation = artifacts.require('XBEInflation');
const SimpleXBEInflation = artifacts.require('SimpleXBEInflation');
const VeXBE = artifacts.require('VeXBE');
const Voting = artifacts.require('Voting');
const VotingStakingRewards = artifacts.require('VotingStakingRewards');
// const StakingRewards = artifacts.require('StakingRewards');
const Registrator = artifacts.require('LockSubscription');
const BonusCampaign = artifacts.require('BonusCampaign');
const ReferralProgram = artifacts.require('ReferralProgram');
const MockToken = artifacts.require('MockToken');
const Treasury = artifacts.require('Treasury');
// const XBE = artifacts.require('XBE');
const Registry = artifacts.require('Registry');
const Controller = artifacts.require('Controller');
const StableSwapUSDT = artifacts.require('StableSwapMockPool');
const ERC20LP = artifacts.require('ERC20LP');
const BaseRewardPool = artifacts.require('BaseRewardPool');
const Booster = artifacts.require('Booster');
const ERC20CRV = artifacts.require('ERC20CRV');
const CVX = artifacts.require('ConvexToken');

const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory');
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair');
const WETH9 = artifacts.require('WETH9');

// Strategies and vaults
const HiveStrategy = artifacts.require('HiveStrategy');
const HiveVault = artifacts.require('HiveVault');

const SushiStrategy = artifacts.require('SushiStrategy');
const SushiVault = artifacts.require('SushiVault');

const CVXStrategy = artifacts.require('CVXStrategy');
const CVXVault = artifacts.require('CVXVault');

const CvxCrvStrategy = artifacts.require('CvxCrvStrategy');
const CvxCrvVault = artifacts.require('CvxCrvVault');

const defaultParams = {
  sushiswapPair: {
    xbeAmountForPair: ether('2'),
    wethAmountForPair: ether('1'),
  },
  // treasury: {
  //   slippageTolerance: new BN('3'),
  //   swapDeadline: new BN('300'),
  // },
  bonusCampaign: {
    rewardsDuration: months('6'),
    emission: ether('5000'),
    stopRegisterTime: days('30'),
    startMintTime: months('18'),
  },
  mockTokens: {
    mockedTotalSupplyXBE: ether('2000'),
    mockedTotalSupplyOtherToken: ether('2000'),
    mockedAmountXBE: ether('100'),
    mockedAmountOtherToken: ether('100'),
  },
  xbeinflation: {
    initialSupply: new BN('5000'),
    initialRate: new BN('50').mul(MULTIPLIER).div(YEAR), // new BN('10000').mul(MULTIPLIER).div(YEAR)
    rateReductionTime: days('7'),
    rateReductionCoefficient: new BN('100').mul(MULTIPLIER), // new BN('10').mul(MULTIPLIER)
    rateDenominator: MULTIPLIER,
    inflationDelay: days('7'),
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
  dependentsAddresses: { ...distro.rinkeby },
  sushiSwap: {
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    sushiswapFactory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
  },
};

const deployInfrastructure = (owner, alice, bob, params) => {
  const contracts = {};

  const distributeTokens = async () => {
    // mockTokenForSushiPair = await MockToken.at(getSavedAddress('mockTokenForSushiPair'));

    // XBE to alice
    await contracts.mockXBE.transfer(alice, params.mockTokens.mockedAmountXBE, {
      from: owner,
    });

    // XBE to bob
    await contracts.mockXBE.transfer(bob, params.mockTokens.mockedAmountXBE, {
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

  const proceed = async () => {
    console.log('Deploying...');
    const { sushiSwap } = params;

    const now = await time.latest();

    contracts.registry = await Registry.new({ from: owner });
    // contracts.referralProgram = await ReferralProgram.new({ from: owner });
    contracts.treasury = await Treasury.new({ from: owner });
    contracts.controller = await Controller.new({ from: owner });

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
          items[i].new(
            { from: owner },
          ),
        );
      }

      return Promise.all(result);
    };

    [
      // contracts.hiveStrategy,
      // contracts.cvxStrategy,
      // contracts.cvxCrvStrategy,
      contracts.sushiStrategy,
      // contracts.hiveVault,
      // contracts.cvxVault,
      // contracts.cvxCrvVault,
      contracts.sushiVault,
    ] = await deployStrategiesAndVaults(strategiesAndVaults);

    contracts.mockXBE = await MockToken.new('Mock XBE', 'mXBE', params.mockTokens.mockedTotalSupplyXBE, { from: owner });
    contracts.xbeInflation = await XBEInflation.new({ from: owner });
    contracts.simpleXBEInflation = await SimpleXBEInflation.new({ from: owner });

    // Deposit weth
    contracts.weth9 = await WETH9.at(sushiSwap.weth);
    await contracts.weth9.deposit({ from: owner, value: ether('1') });

    contracts.bonusCampaign = await BonusCampaign.new({ from: owner });
    contracts.registrator = await Registrator.new({ from: owner });
    contracts.veXBE = await VeXBE.new({ from: owner });
    contracts.voting = await Voting.new({ from: owner });
    contracts.votingStakingRewards = await VotingStakingRewards.new({ from: owner });

    contracts.sushiSwapRouter = await IUniswapV2Router02.at(sushiSwap.sushiswapRouter);
    contracts.sushiSwapFactory = await IUniswapV2Factory.at(sushiSwap.sushiswapFactory);

    await contracts.mockXBE.approve(
      contracts.sushiSwapRouter.address,
      params.sushiswapPair.xbeAmountForPair,
      { from: owner },
    );

    await contracts.weth9.approve(
      contracts.sushiSwapRouter.address,
      params.sushiswapPair.wethAmountForPair,
      { from: owner },
    );

    await contracts.sushiSwapRouter.addLiquidity(
      contracts.mockXBE.address,
      contracts.weth9.address,
      params.sushiswapPair.xbeAmountForPair,
      params.sushiswapPair.wethAmountForPair,
      params.sushiswapPair.xbeAmountForPair,
      params.sushiswapPair.wethAmountForPair,
      owner,
      now.add(new BN('3600')),
    );

    contracts.sushiLP = await IUniswapV2Pair.at(
      await contracts.sushiSwapFactory.getPair(
        contracts.mockXBE.address,
        contracts.weth9.address,
      ),
    );

    // stableSwapUSDT = await StableSwapUSDT.at(
    //   dependentsAddresses.curve.pool_data.mock_pool.swap_address,
    // );

    // contracts.erc20LP = await ERC20LP
    //   .at(dependentsAddresses.curve.pool_data.mock_pool.lp_token_address);
    // contracts.baseRewardPool = await BaseRewardPool
    //   .at(dependentsAddresses.convex.pools[0].crvRewards);
    // contracts.booster = await Booster
    //   .at(dependentsAddresses.convex.booster);
    // contracts.crv = await ERC20CRV
    //   .at(dependentsAddresses.curve.CRV);
    // contracts.cvx = await CVX
    //   .at(dependentsAddresses.convex.cvx);
    // console.log('Contracts deployed');
    await distributeTokens();
    return contracts;
  };

  const configure = async () => {
    console.log('Configuring...');
    const { dependentsAddresses } = params;

    const now = await time.latest();

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
      // {
      //   name: 'cvxCrv',
      //   vault: contracts.cvxCrvVault,
      //   strategy: contracts.cvxCrvStrategy,
      //   strategyConfigArgs: [
      //     dependentsAddresses.convex.cvxCrv, // _wantAddress,
      //     contracts.controller.address, // _controllerAddress,
      //     contracts.cvxCrvVault.address, // _vaultAddress,
      //     owner, // _governance,
      //     // voting.address,
      //     ZERO_ADDRESS, // _voting,
      //     // _poolSettings
      //     [
      //       dependentsAddresses.curve.pool_data.mock_pool.lp_token_address, // lpCurve
      //       dependentsAddresses.convex.cvxCrvRewards, // cvxCRVRewards
      //       dependentsAddresses.convex.crvDepositor, // crvDepositor
      //       dependentsAddresses.convex.booster, // convexBooster
      //       dependentsAddresses.convex.cvxCrv, // cvxCrvToken
      //       dependentsAddresses.curve.CRV, // crvToken
      //     ],
      //   ],
      //   vaultConfigArgs: [
      //     dependentsAddresses.convex.cvxCrv, // _initialToken
      //     contracts.controller.address, // _initialController
      //     owner, // _governance
      //     contracts.referralProgram.address, // _referralProgram
      //     contracts.treasury.address, // _treasury
      //     now.add(months('23')), // _rewardsDuration
      //     [ // _rewardTokens
      //       dependentsAddresses.convex.cvxCrv,
      //       dependentsAddresses.convex.cvxCrv,
      //     ],
      //     'CC', // _namePostfix
      //     'CC', // _symbolPostfix
      //   ],
      //   token: dependentsAddresses.convex.cvxCrv,
      // },
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
        vault: contracts.sushiVault,
        strategy: contracts.sushiStrategy,
        strategyConfigArgs: [
          contracts.sushiLP.address, // _wantAddress,
          contracts.controller.address, // _controllerAddress,
          contracts.sushiVault.address, // _vaultAddress,
          owner, // _governance,
          // _poolSettings
          [
            contracts.sushiLP.address,
            contracts.mockXBE.address,
          ],
        ],
        vaultConfigArgs: [
          contracts.sushiLP.address, // _initialToken
          contracts.controller.address, // _initialController
          owner, // _governance
          days('7'), // _rewardsDuration
          contracts.mockXBE.address, // _tokenToAutostake,
          contracts.votingStakingRewards.address, // _votingStakingRewards
          //          true, // _enableFees
          [ // _rewardTokens
            contracts.mockXBE.address,
          ],
          'SH', // _namePostfix
          'SH', // _symbolPostfix
        ],
        token: contracts.sushiLP.address,
      },
    ];

    // console.log('Starting configuration...');

    // await contracts.referralProgram.configure(
    //   [
    //     contracts.mockXBE.address,
    //     dependentsAddresses.convex.cvx,
    //     dependentsAddresses.convex.cvxCrv,
    //   ],
    //   contracts.treasury.address,
    //   { from: owner },
    // );
    // // console.log('ReferralProgram configured...');

    await contracts.registry.configure(
      owner,
      { from: owner },
    );

    // console.log('Registry configured...');

    await contracts.treasury.configure(
      contracts.voting.address,
      contracts.votingStakingRewards.address,
      contracts.mockXBE.address,
      dependentsAddresses.uniswap_router_02,
      dependentsAddresses.uniswap_factory,
      params.treasury.slippageTolerance,
      now.add(params.treasury.swapDeadline),
      { from: owner },
    );
    // console.log('Treasury configured...');

    await contracts.controller.configure(
      contracts.treasury.address,
      owner,
      owner,
      { from: owner },
    );
    // console.log('Controller configured...');

    // console.log('Vaults and Strategies configuration...');
    for (const item of strategiesAndVaults) {
      // console.log(`Configuring ${item.name}...`);

      await contracts.controller.setVault(
        item.token,
        item.vault.address,
        { from: owner },
      );

      // console.log('Controller: vault added...');

      await contracts.controller.setApprovedStrategy(
        item.token,
        item.strategy.address,
        true,
        { from: owner },
      );

      // console.log('Controller: strategy approved...');

      await contracts.controller.setStrategy(
        item.token,
        item.strategy.address,
        { from: owner },
      );

      // console.log('Controller: strategy added...');

      await item.strategy.configure(
        ...item.strategyConfigArgs,
        { from: owner },
      );

      // console.log(`${item.name}Strategy: configured`);

      // eslint-disable-next-line no-await-in-loop
      await item.vault.configure(
        ...item.vaultConfigArgs,
        { from: owner },
      );

      await item.vault.setRewardsDistribution(
        item.strategy.address,
        { from: owner },
      );

      //      await item.vault.addFeeReceiver(
      //        contracts.treasury.address,
      //        new BN('10'),
      //        [
      //          contracts.mockXBE.address,
      //        ],
      //        true,
      //        { from: owner },
      //      );
      // console.log(`${item.name}Vault: configured`);
    }

    await contracts.xbeInflation.configure(
      contracts.mockXBE.address,
      params.xbeinflation.initialSupply,
      params.xbeinflation.initialRate,
      params.xbeinflation.rateReductionTime,
      params.xbeinflation.rateReductionCoefficient,
      params.xbeinflation.rateDenominator,
      params.xbeinflation.inflationDelay,
      { from: owner },
    );

    await contracts.xbeInflation.addXBEReceiver(
      contracts.sushiStrategy.address,
      new BN('100'),
      { from: owner },
    );

    contracts.simpleXBEInflation.configure(
      contracts.mockXBE.address, // _token
      params.simpleXBEInflation.targetMinted, // _targetMinted
      params.simpleXBEInflation.periodsCount, // periodsCount
      params.simpleXBEInflation.periodDuration,
      { from: owner },
    );

    await contracts.simpleXBEInflation.addXBEReceiver(
      contracts.sushiStrategy.address,
      new BN('25'),
      { from: owner },
    );

    await contracts.simpleXBEInflation.addXBEReceiver(
      contracts.treasury.address,
      new BN('25'),
      { from: owner },
    );
    // console.log('XBEInflation: configured');

    await contracts.bonusCampaign.configure(
      contracts.mockXBE.address,
      contracts.veXBE.address,
      now.add(params.bonusCampaign.startMintTime),
      now.add(params.bonusCampaign.stopRegisterTime),
      params.bonusCampaign.rewardsDuration,
      params.bonusCampaign.emission,
      { from: owner },
    );

    await contracts.bonusCampaign.setRegistrator(
      contracts.registrator.address,
      { from: owner },
    );
    // console.log('BonusCampaign: configured');

    console.log('registrator address', contracts.registrator.address);
    await contracts.registrator.addSubscriber(contracts.bonusCampaign.address, { from: owner });
    await contracts.registrator.setEventSource(contracts.veXBE.address, { from: owner });

    await contracts.veXBE.configure(
      contracts.mockXBE.address,
      contracts.votingStakingRewards.address,
      contracts.registrator.address,
      'Voting Escrowed XBE',
      'veXBE',
      '0.0.1',
      { from: owner },
    );
    // console.log('VeXBE: configured...');

    await contracts.voting.initialize(
      contracts.veXBE.address,
      params.voting.supportRequiredPct,
      params.voting.minAcceptQuorumPct,
      params.voting.voteTime,
      { from: owner },
    );
    // console.log('Voting: configured...');

    await contracts.votingStakingRewards.configure(
      contracts.treasury.address,
      contracts.mockXBE.address,
      contracts.mockXBE.address,
      days('7'),
      contracts.veXBE.address,
      contracts.voting.address,
      contracts.bonusCampaign.address,
      contracts.treasury.address,
      [
        contracts.sushiVault.address,
      ],
    );

    // console.log('VotingStakingRewards: configured...');

    console.log('Contracts configured');
  };

  return {
    proceed,
    configure,
  };
};

module.exports = {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  months,
  defaultParams,
  // beforeEachWithSpecificDeploymentParams,
};
