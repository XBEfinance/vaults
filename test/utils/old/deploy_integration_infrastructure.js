/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

const {
  BN,
  ether,
  time,
} = require('@openzeppelin/test-helpers');

const testnet_distro = require('../../../../curve-convex/rinkeby_distro.json');

const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));

const SimpleXBEInflation = artifacts.require('SimpleXBEInflation');
const VeXBE = artifacts.require('VeXBE');
// const Voting = artifacts.require('Voting');
const VotingStakingRewards = artifacts.require('VotingStakingRewards');
// const StakingRewards = artifacts.require('StakingRewards');
const LockupRegistrator = artifacts.require('LockSubscription');
const BonusCampaign = artifacts.require('BonusCampaign');
// const ReferralProgram = artifacts.require('ReferralProgram');
const MockToken = artifacts.require('MockToken');
const Treasury = artifacts.require('Treasury');
// const XBE = artifacts.require('XBE');
const Registry = artifacts.require('Registry');
const Controller = artifacts.require('Controller');
// const StableSwapUSDT = artifacts.require('StableSwapMockPool');
// const ERC20LP = artifacts.require('ERC20LP');
// const BaseRewardPool = artifacts.require('BaseRewardPool');
// const Booster = artifacts.require('Booster');
// const ERC20CRV = artifacts.require('ERC20CRV');
// const CVX = artifacts.require('ConvexToken');

const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory');
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair');
const WETH9 = artifacts.require('WETH9');

// Strategies and vaults
const SushiStrategy = artifacts.require('SushiStrategy');
const SushiVault = artifacts.require('SushiVault');

const defaultParams = {
  xbeAddress: '0x8ce5F9558e3E0cd7dE8bE15a93DffABEC83E314e',
  wethAddress: '0xc778417E063141139Fce010982780140Aa0cD5Ab',

  sushiVault: {
    rewardsDuration: days('7'),
  },
  sushiswapPair: {
    xbeAmountForPair: ether('2'),
    wethAmountForPair: ether('1'),
  },
  bonusCampaign: {
    rewardsDuration: months('6'),
    emission: ether('5000'),
    stopRegisterDuration: days('30'),
    startMintDuration: months('18'),
  },
  mockTokens: {
    mockedTotalSupplyXBE: ether('2000'),
    mockedTotalSupplyOtherToken: ether('2000'),
    mockedAmountXBE: ether('100'),
    mockedAmountOtherToken: ether('100'),
  },
  simpleXBEInflation: {
    targetMinted: ether('10000'),
    periodsCount: new BN('52'),
    periodDuration: new BN('604800'),
    sushiWeight: new BN('7500'),
    treasuryWeight: new BN('2500'),
  },
  voting: {
    supportRequiredPct: new BN('5100'),
    minAcceptQuorumPct: new BN('3000'),
    voteTime: new BN('1000000'),
  },
  treasury: {
    slippageTolerance: new BN('9700'),
    swapDeadline: new BN('1800'),
  },
  veXBE: {
    minLockDuration: new BN('3600'),
  },
  votingStakingRewards: {
    rewardsDuration: days('7'),
    bondedLockDuration: new BN('600'),
  },
  dependentsAddresses: { ...testnet_distro.rinkeby },
  sushiSwap: {
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    sushiswapFactory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
  },
};

const deployInfrastructure = (owner, alice, bob, params) => {
  const contracts = {};

  const distributeTokens = async () => {
    console.log('distribute tokens...');

    const amount = params.mockTokens.mockedAmountXBE;
    for await (v of [owner, alice, bob]) {
      await contracts.mockXBE.mintSender(amount, { from: v });
    }

    console.log('distribute tokens finished');
  };

  const deployStrategiesAndVaults = async (items) => {
    const result = [];
    for (let i = 0; i < items.length; i += 1) {
      result.push( items[i].new({ from: owner }));
    }

    return Promise.all(result);
  };

  const proceed = async () => {
    // get tokens contracts
    contracts.mockXBE = await MockToken.at(params.xbeAddress);
    contracts.weth9 = await WETH9.at(params.wethAddress);

    await distributeTokens();

    console.log('Deploying...');
    const { sushiSwap } = params;

    const now = await time.latest();

    contracts.registry = await Registry.new({ from: owner });
    contracts.treasury = await Treasury.new({ from: owner });
    contracts.controller = await Controller.new({ from: owner });

    const strategiesAndVaults = [
      SushiStrategy,
      SushiVault,
    ];

    [
      contracts.sushiStrategy,
      contracts.sushiVault,
    ] = await deployStrategiesAndVaults(strategiesAndVaults);

    contracts.simpleXBEInflation = await SimpleXBEInflation.new({ from: owner });
    contracts.bonusCampaign = await BonusCampaign.new({ from: owner });
    contracts.lockupRegistrator = await LockupRegistrator.new({ from: owner });
    contracts.veXBE = await VeXBE.new({ from: owner });
    contracts.votingStakingRewards = await VotingStakingRewards.new({ from: owner });

    contracts.sushiSwapRouter = await IUniswapV2Router02.at(sushiSwap.sushiswapRouter);
    contracts.sushiSwapFactory = await IUniswapV2Factory.at(sushiSwap.sushiswapFactory);

    contracts.sushiLP = await IUniswapV2Pair.at(
      await contracts.sushiSwapFactory.getPair(
        contracts.mockXBE.address,
        contracts.weth9.address,
      ),
    );

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
          owner, // _governance,
          contracts.mockXBE.address,
        ],
        vaultConfigArgs: [
          contracts.sushiLP.address, // _initialToken
          contracts.controller.address, // _initialController
          owner, // _governance
          params.sushiVault.rewardsDuration,
          contracts.mockXBE.address, // _tokenToAutostake,
          contracts.votingStakingRewards.address, // _votingStakingRewards
          [ // _rewardTokens
            contracts.mockXBE.address,
          ],
          'SH', // _namePostfix
          'SH', // _symbolPostfix
        ],
        token: contracts.sushiLP.address,
      },
    ];

    console.log('Starting configuration...');

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

    // console.log('Registry configured...');

    await contracts.treasury.configure(
      owner,
      contracts.votingStakingRewards.address,
      contracts.mockXBE.address,
      dependentsAddresses.uniswap_router_02,
      params.treasury.slippageTolerance,
      now.add(params.treasury.swapDeadline),
      { from: owner },
    );
    console.log('Treasury configured...');

    await contracts.controller.configure(
      contracts.treasury.address,
      owner,
      owner,
      { from: owner },
    );
    console.log('Controller configured...');

    console.log('Vaults and Strategies configuration...');
    for (const item of strategiesAndVaults) {
      console.log(`Configuring ${item.name}...`);

      await contracts.controller.setVault(
        item.token,
        item.vault.address,
        { from: owner },
      );

      console.log('Controller: vault added...');

      await contracts.controller.setApprovedStrategy(
        item.token,
        item.strategy.address,
        true,
        { from: owner },
      );

      console.log('Controller: strategy approved...');

      await contracts.controller.setStrategy(
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
      // don't remove, required for
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

    contracts.simpleXBEInflation.configure(
      contracts.mockXBE.address, // _token
      params.simpleXBEInflation.targetMinted, // _targetMinted
      params.simpleXBEInflation.periodsCount, // periodsCount
      params.simpleXBEInflation.periodDuration,
      { from: owner },
    );

    await contracts.simpleXBEInflation.setXBEReceiver(
      contracts.sushiStrategy.address,
      new BN('7500'),
      { from: owner },
    );

    await contracts.simpleXBEInflation.setXBEReceiver(
      contracts.treasury.address,
      new BN('2500'),
      { from: owner },
    );
    console.log('SimpleXBEInflation: configured');

    console.log('now', now.toString());
    console.log('params',
      params.bonusCampaign.startMintDuration.toString(),
      params.bonusCampaign.stopRegisterDuration.toString()
    );

    await contracts.bonusCampaign.configure(
      contracts.mockXBE.address,
      contracts.veXBE.address,
      now.add(params.bonusCampaign.startMintDuration),
      now.add(params.bonusCampaign.stopRegisterDuration),
      params.bonusCampaign.rewardsDuration,
      params.bonusCampaign.emission,
      { from: owner },
    );

    await contracts.bonusCampaign.setRegistrator(
      contracts.lockupRegistrator.address,
      { from: owner },
    );

    console.log('lockupRegistrator address', contracts.lockupRegistrator.address);
    await contracts.lockupRegistrator.addSubscriber(contracts.bonusCampaign.address, { from: owner });
    await contracts.lockupRegistrator.setEventSource(contracts.veXBE.address, { from: owner });

    console.log('BonusCampaign: configured');

    await contracts.veXBE.configure(
      contracts.mockXBE.address,
      contracts.votingStakingRewards.address,
      contracts.lockupRegistrator.address,
      params.veXBE.minLockDuration,
      'Voting Escrowed XBE',
      'veXBE',
      '0.0.1',
      { from: owner },
    );
    console.log('VeXBE: configured...');

    await contracts.votingStakingRewards.configure(
      contracts.treasury.address,
      contracts.mockXBE.address,
      contracts.mockXBE.address,
      params.votingStakingRewards.rewardsDuration,
      contracts.veXBE.address,
      contracts.bonusCampaign.address,
      contracts.treasury.address,
      params.votingStakingRewards.bondedLockDuration,
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
};
