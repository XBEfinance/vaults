/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const { BN, constants, time } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const fs = require('fs');
const testnet_distro = require('../../curve-convex/distro.json');

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

// const saveItem = (item, value, data) => {
//   if (typeof (value) !== 'undefined') {
//     data[item] = value;
//   }
// };
//
// const readItem = (itemName, data) => {
//   if (data.has(itemName)) {
//     return data[itemName];
//   }
//   return null;
// };

let contracts = {};

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
  const wrapAddress = (value) => {
    if (typeof value === 'undefined') {
      return '';
    }

    return value.address;
  };

  const jsonAddressData = JSON.stringify({
    mockXBE: wrapAddress(contracts.mockXBE),
    mockLpSushi: wrapAddress(contracts.mockLpSushi),
    xbeInflation: wrapAddress(contracts.xbeInflation),
    registrator: wrapAddress(contracts.registrator),
    bonusCampaign: wrapAddress(contracts.bonusCampaign),
    veXBE: wrapAddress(contracts.veXBE),
    voting: wrapAddress(contracts.voting),
    votingStakingRewards: wrapAddress(contracts.votingStakingRewards),
    referralProgram: wrapAddress(contracts.referralProgram),
    registry: wrapAddress(contracts.registry),
    treasury: wrapAddress(contracts.treasury),
    controller: wrapAddress(contracts.controller),

    hiveStrategy: wrapAddress(contracts.hiveStrategy),
    hiveVault: wrapAddress(contracts.hiveVault),
    sushiStrategy: wrapAddress(contracts.sushiStrategy),
    sushiVault: wrapAddress(contracts.sushiVault),
    cvxStrategy: wrapAddress(contracts.cvxStrategy),
    cvxVault: wrapAddress(contracts.cvxVault),
    cvxCrvStrategy: wrapAddress(contracts.cvxCrvStrategy),
    cvxCrvVault: wrapAddress(contracts.cvxCrvVault),
  });
  fs.writeFileSync('addresses.json', jsonAddressData);
};

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

  const needToDeployMainContracts =   true;
  const needToDeployStrategies =      true;
  const needToAddSushiswapLiquidity = false;  // not required now
  const needTomintOwnerMockXBE =      true;  // enough for him

  if (needToDeployMainContracts) {
    contracts.registry = await deployer.deploy(
      Registry,
      { from: owner },
    );

    contracts.referralProgram = await deployer.deploy(
      ReferralProgram,
      { from: owner },
    );

    contracts.treasury = await deployer.deploy(
      Treasury,
      { from: owner },
    );

    contracts.controller = await deployer.deploy(
      Controller,
      { from: owner },
    );

    // use deployed instance
    contracts.mockXBE = await MockToken.at(addressStore.rinkeby.xbe);
    console.log('mockXBE acquired ', contracts.mockXBE.address);

    // get weth ad address
    contracts.weth9 = await WETH9.at(addressStore.rinkeby.weth);
    console.log('WETH acquired');
    let ownerEthBalance = await contracts.weth9.balanceOf(owner);
    if ((new BN(ownerEthBalance)).lt(ether('1'))) {
      await contracts.weth9.deposit({ from: owner, value: ether('1') });
      ownerEthBalance = await contracts.weth9.balanceOf(owner);
      console.log('WETH owner balance deposited, new balance: ', new BN(ownerEthBalance).toString());
    } else {
      console.log('owner eth balance is enough:', new BN(ownerEthBalance).toString(), 'no deposit required');
    }

    // deploy bonus campaign xbeinflation
    contracts.xbeInflation = await deployer.deploy(SimpleXbeInflation, { from: owner });

    contracts.registrator = await deployer.deploy(Registrator, { from: owner });

    // deploy bonus campaign
    contracts.bonusCampaign = await deployer.deploy(BonusCampaign, { from: owner });

    // deploy voting escrow
    contracts.veXBE = await deployer.deploy(VeXBE, { from: owner });

    contracts.sushiSwapRouter = await IUniswapV2Router02.at(sushiSwap.sushiswapRouter);
    console.log('sushiSwapRouter address: ', contracts.sushiSwapRouter.address);
    contracts.sushiSwapFactory = await IUniswapV2Factory.at(sushiSwap.sushiswapFactory);
    console.log('sushiSwapFactory address: ', contracts.sushiSwapFactory.address);

    if (needTomintOwnerMockXBE) { // false
      await contracts.mockXBE.mintSender(ether('1000'), {from: owner});
    }

    if (needToAddSushiswapLiquidity) {
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
      // no need to add liquidity each time
      await sushiSwapRouter.addLiquidity(
        contracts.mockXBE.address,
        contracts.weth9.address,
        params.sushiswapPair.xbeAmountForPair,
        params.sushiswapPair.wethAmountForPair,
        params.sushiswapPair.xbeAmountForPair,
        params.sushiswapPair.wethAmountForPair,
        owner,
        now.add(new BN('3600')),
      );
    }

    // it is the same each time, bcause mockXBE & weth9 are fixed
    contracts.mockLpSushi = await IUniswapV2Pair.at(
      await contracts.sushiSwapFactory.getPair(
        contracts.mockXBE.address,
        contracts.weth9.address,
      ),
    );

    contracts.mockLpSushi = await IUniswapV2Pair.at(addressStore.rinkeby.mockLpSushi);
    console.log('mockLpSushi address: ', contracts.mockLpSushi.address);

    // deploy voting
    contracts.voting = await deployer.deploy(Voting, { from: owner });

    // voting will be deployed separately
    contracts.votingStakingRewards = await deployer.deploy(VotingStakingRewards, { from: owner });
    console.log('votingStakingRewards address: ', contracts.votingStakingRewards.address);
  }

  if (needToDeployStrategies) {
    const strategiesAndVaults = [
      HiveStrategy,
      CVXStrategy,
      CvxCrvStrategy,
      SushiStrategy,
      HiveVault,
      CVXVault,
      CvxCrvVault,
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

    const [
      hiveStrategy,
      cvxStrategy,
      cvxCrvStrategy,
      sushiStrategy,
      hiveVault,
      cvxVault,
      cvxCrvVault,
      sushiVault,
    ] = await deployStrategiesAndVaults(strategiesAndVaults);

    contracts.hiveStrategy = hiveStrategy;
    contracts.hiveVault = hiveVault;
    contracts.cvxStrategy = cvxStrategy;
    contracts.cvxVault = cvxVault;
    contracts.cvxCrvStrategy = cvxCrvStrategy;
    contracts.cvxCrvVault = cvxCrvVault;
    contracts.sushiStrategy = sushiStrategy;
    contracts.sushiVault = sushiVault;
    // !-----------------------------------
  }

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

const loadContracts = async () => {
  contracts.mockXBE = await MockToken.at(getSavedAddress('mockXBE'));

  contracts.voting = await Voting.at(getSavedAddress('voting'));
  contracts.votingStakingRewards = await VotingStakingRewards.at(getSavedAddress('votingStakingRewards'));

  contracts.registrator = await Registrator.at(getSavedAddress('registrator'));
  contracts.xbeInflation = await SimpleXbeInflation.at(getSavedAddress('xbeInflation'));

  contracts.bonusCampaign = await BonusCampaign.at(getSavedAddress('bonusCampaign'));
  contracts.veXBE = await VeXBE.at(getSavedAddress('veXBE'));
  //
  contracts.referralProgram = await ReferralProgram.at(getSavedAddress('referralProgram'));
  contracts.registry = await Registry.at(getSavedAddress('registry'));
  contracts.treasury = await Treasury.at(getSavedAddress('treasury'));
  contracts.controller = await Controller.at(getSavedAddress('controller'));

  contracts.hiveVault = await HiveVault.at(getSavedAddress('hiveVault'));
  contracts.hiveStrategy = await HiveStrategy.at(getSavedAddress('hiveStrategy'));

  contracts.cvxCrvVault = await CvxCrvVault.at(getSavedAddress('cvxCrvVault'));
  contracts.cvxCrvStrategy = await CvxCrvStrategy.at(getSavedAddress('cvxCrvStrategy'));

  contracts.cvxVault = await CVXVault.at(getSavedAddress('cvxVault'));
  contracts.cvxStrategy = await CVXStrategy.at(getSavedAddress('cvxStrategy'));

  contracts.sushiVault = await SushiVault.at(getSavedAddress('sushiVault'));
  contracts.sushiStrategy = await SushiStrategy.at(getSavedAddress('sushiStrategy'));

  contracts.mockLpSushi = await IUniswapV2Pair.at(getSavedAddress('mockLpSushi'));
};

const configureContracts = async (params, owner) => {
  const { dependentsAddresses, sushiSwap } = params;
  // const now = await time.latest();
  const now = getNowBN();

  const needToConfigure = {
    strategiesAndVaults: true,
    mainContracts: true,
  };

  const needToStart = {
    bonusCampaign: true,
    inflation: true,
  }

  await loadContracts();

  const addXBEMinter = async (minter) => {
    if (!await contracts.mockXBE.getMinters(minter)) {
      await contracts.mockXBE.addMinter(minter);
    }
  };

  // add XBE minters! in mainnet
  // await addXBEMinter(contracts.bonusCampaign.address);
  // await addXBEMinter(contracts.xbeInflation.address);

  const strategiesAndVaults = [
    {
      name: 'hive',
      vault: contracts.hiveVault,
      strategy: contracts.hiveStrategy,
      strategyConfigArgs: [
        dependentsAddresses.convex.pools[0].lptoken, // _wantAddress,
        contracts.controller.address, // _controllerAddress,
        owner, // _governance,
        // _poolSettings
        [
          dependentsAddresses.curve.pool_data.mock_pool.lp_token_address,
          dependentsAddresses.convex.pools[0].crvRewards,
          dependentsAddresses.convex.cvxRewards,
          dependentsAddresses.convex.booster,
          ZERO,
          dependentsAddresses.curve.CRV,
          dependentsAddresses.convex.cvx,
        ],
      ],
      vaultConfigArgs: [
        dependentsAddresses.convex.pools[0].lptoken,  // _wantAddress,
        contracts.controller.address,                 // _initialController
        owner,                                        // _governance
        days('7'),                                 // _rewardsDuration
        contracts.mockXBE.address,                    // tokenToAutostake,
        contracts.votingStakingRewards.address,       // votingStakingRewards,
        true,                                         // enableFees ? false
        owner,                                        // teamWallet ? address(0) ?
        contracts.referralProgram.address,            // _referralProgram
        contracts.treasury.address,                   // _treasury
        [                                             // _rewardTokens
          dependentsAddresses.curve.CRV,
          dependentsAddresses.convex.cvx, // ???????
          contracts.mockXBE.address,
        ],
        'Hive', // _namePostfix
        'HV',   // _symbolPostfix
      ],
      token: dependentsAddresses.convex.pools[0].lptoken,
    },
    {
      name: 'cvxCrv',
      vault: contracts.cvxCrvVault,
      strategy: contracts.cvxCrvStrategy,
      strategyConfigArgs: [
        dependentsAddresses.convex.cvxCrv,      // _wantAddress,
        contracts.controller.address,           // _controllerAddress,
        owner,                                  // _governance,
        ZERO_ADDRESS,                           // _voting,
        // _poolSettings
        [
          dependentsAddresses.curve.pool_data.mock_pool.lp_token_address, // lpCurve
          dependentsAddresses.convex.cvxCrvRewards,                       // cvxCRVRewards
          dependentsAddresses.convex.crvDepositor,                        // crvDepositor
          dependentsAddresses.convex.booster,                             // convexBooster
          dependentsAddresses.convex.cvxCrv,                              // cvxCrvToken
          dependentsAddresses.curve.CRV,                                  // crvToken
        ],
      ],
      vaultConfigArgs: [
        dependentsAddresses.convex.cvxCrv,      // _initialToken
        contracts.controller.address,           // _initialController
        owner,                                  // _governance
        days('7'),                           // _rewardsDuration
        contracts.mockXBE.address,              // tokenToAutostake,
        contracts.votingStakingRewards.address, // votingStakingRewards,
        true,                                   // enableFees ? false
        owner,                                  // teamWallet ? address(0) ?
        contracts.referralProgram.address,      // _referralProgram
        contracts.treasury.address,             // _treasury
        [ // _rewardTokens
          dependentsAddresses.convex.cvxCrv,    // ???????
          contracts.mockXBE.address,
        ],
        'cvxCRV', // _namePostfix
        'CR',     // _symbolPostfix
      ],
      token: dependentsAddresses.convex.cvxCrv,
    },
    {
      name: 'cvx',
      vault: contracts.cvxVault,
      strategy: contracts.cvxStrategy,
      strategyConfigArgs: [
        dependentsAddresses.convex.cvx,         // _wantAddress,
        contracts.controller.address,           // _controllerAddress,
        owner,                                  // _governance,
        // _poolSettings
        [
          dependentsAddresses.convex.cvxRewards,// cvxRewards
          dependentsAddresses.convex.cvx,       // cvxToken
          ZERO,                                 // poolIndex
        ],
      ],
      token: dependentsAddresses.convex.cvx,
      vaultConfigArgs: [
        dependentsAddresses.convex.cvx,         // _initialToken
        contracts.controller.address,           // _initialController
        owner,                                  // _governance
        days('7'),                           // _rewardsDuration
        contracts.mockXBE.address,              // tokenToAutostake,
        contracts.votingStakingRewards.address, // votingStakingRewards,
        true,                                   // enableFees ? false
        owner,                                  // teamWallet ? address(0) ?
        contracts.referralProgram.address,      // _referralProgram
        contracts.treasury.address,             // _treasury
        [ // _rewardTokens
          dependentsAddresses.convex.cvxCrv, // ???????
          contracts.mockXBE.address,
        ],
        'XC', // _namePostfix
        'XC', // _symbolPostfix
      ],
    },
    {
      name: 'sushi',
      vault: contracts.sushiVault,
      strategy: contracts.sushiStrategy,
      strategyConfigArgs: [
        contracts.mockLpSushi.address,          // _wantAddress,
        contracts.controller.address,           // _controllerAddress,
        owner,                                  // _governance,
        // _poolSettings
        // [
        //   contracts.mockLpSushi.address,
          contracts.mockXBE.address,
          // dependentsAddresses.convex.cvx, // ???
        // ],
      ],
      vaultConfigArgs: [
        contracts.mockLpSushi.address,          // _initialToken
        contracts.controller.address,           // _initialController
        owner,                                  // _governance
        days('7'),                           // _rewardsDuration
        contracts.mockXBE.address,              // _tokenToAutostake
        contracts.votingStakingRewards.address, // _votingStakingRewards
        [ // _rewardTokens
          contracts.mockXBE.address,
        ],
        'SH', // _namePostfix
        'SH', // _symbolPostfix
      ],
      token: contracts.mockLpSushi.address,
    },
  ];

  console.log('Starting configuration...');

  if (needToConfigure.strategiesAndVaults) {
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

      await contracts.registry.addVault(
        item.vault.address,
        {
          from: owner,
        },
      );

      console.log(`${item.name}Vault: configured`);
    }

    console.log('All vaults and strategies have been configured...');
  }

  if (needToConfigure.mainContracts) {
    await contracts.referralProgram.configure(
      [contracts.mockXBE.address, dependentsAddresses.convex.cvx, dependentsAddresses.convex.cvxCrv],
      contracts.treasury.address,
      contracts.registry.address,
      { from: owner },
    );

    console.log('ReferralProgram configured...');

    await contracts.registry.configure(
      owner,
      { from: owner },
    );

    console.log('Registry configured...');

    await contracts.treasury.configure(
      contracts.voting.address,
      contracts.votingStakingRewards.address,
      contracts.mockXBE.address,
      dependentsAddresses.uniswap_router_02,
      params.treasury.slippageTolerance,
      params.treasury.swapDeadline,
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

    contracts.xbeInflation.configure(
      contracts.mockXBE.address, // _token
      params.simpleXBEInflation.targetMinted,
      params.simpleXBEInflation.periodsCount,
      params.simpleXBEInflation.periodDuration,
      { from: owner },
    );

    await contracts.xbeInflation.setXBEReceiver(
      contracts.sushiStrategy.address,
      new BN('75'),
      { from: owner },
    );

    // instead of VotingStakingRewards: reward -> treasury -> votingStakingRewards
    await contracts.xbeInflation.setXBEReceiver(
      contracts.treasury.address,
      new BN('25'),
      { from: owner },
    );

    console.log('weight sushi', await contracts.xbeInflation.weights(contracts.sushiStrategy.address));
    console.log('weight treasury', await contracts.xbeInflation.weights(contracts.treasury.address));
    console.log('sumWeights', await contracts.xbeInflation.sumWeight());

    console.log('XBEInflation: configured');

    await contracts.bonusCampaign.configure(
      contracts.mockXBE.address,
      contracts.veXBE.address,
      now.add(params.bonusCampaign.startMintTime),
      now.add(params.bonusCampaign.stopRegisterTime),
      params.bonusCampaign.rewardsDuration,
      params.bonusCampaign.emission,
      { from: owner },
    );

    await contracts.bonusCampaign.setRegistrator(contracts.registrator.address, { from: owner });

    if (needToStart.bonusCampaign) {
      await contracts.bonusCampaign.startMint({ from: owner });
    }

    console.log('BonusCampaign: configured');

    await contracts.veXBE.configure(
      contracts.mockXBE.address,
      contracts.votingStakingRewards.address,
      contracts.registrator.address,
      params.veXBE.minLockDuration,
      'Voting Escrowed XBE',
      'veXBE',
      '0.0.1',
      { from: owner },
    );

    console.log('registrator address', contracts.registrator.address);
    await contracts.registrator.addSubscriber(contracts.bonusCampaign.address, { from: owner });
    await contracts.registrator.setEventSource(contracts.veXBE.address, { from: owner });

    console.log('VeXBE: configured...');

    await contracts.voting.initialize(
      contracts.veXBE.address,
      params.voting.supportRequiredPct,
      params.voting.minAcceptQuorumPct,
      params.voting.voteTime,
      { from: owner },
    );

    console.log('Voting: configured...');

    await contracts.votingStakingRewards.configure(
      contracts.treasury.address,
      contracts.mockXBE.address,
      contracts.mockXBE.address,
      params.votingStakingRewards.rewardsDuration,
      contracts.veXBE.address,
      contracts.voting.address,
      contracts.bonusCampaign.address, // works as a boost logic provider for now
      contracts.treasury.address, // to send remaining shares
      params.votingStakingRewards.bondedLockDuration,
      [
        contracts.sushiVault.address,
        contracts.cvxVault.address,
        contracts.cvxCrvVault.address,
        contracts.hiveVault.address,
      ],
    );

    console.log('VotingStakingRewards: configured...');

    // mint inflation
    if (needToStart.inflation) {
      await contracts.xbeInflation.mintForContracts({ from: owner });
    }
  }

  console.log('Configuration completed!..');
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
      swapDeadline: new BN('9700'),
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
    // xbeinflation: {
    //   initialSupply: new BN('5000'),
    //   initialRate: new BN('274815283').mul(MULTIPLIER).div(YEAR), // new BN('10000').mul(MULTIPLIER).div(YEAR)
    //   rateReductionTime: YEAR,
    //   rateReductionCoefficient: new BN('1189207115002721024'), // new BN('10').mul(MULTIPLIER)
    //   rateDenominator: MULTIPLIER,
    //   inflationDelay: new BN('86400'),
    // },
    simpleXBEInflation: {
      targetMinted: ether('10000'),
      periodsCount: new BN('52'),
      periodDuration: new BN('604800'),
    },
    voting: {
      supportRequiredPct: new BN('5100'),
      minAcceptQuorumPct: new BN('3000'),
      voteTime: new BN('1000000'),
    },
    votingStakingRewards: {
      rewardsDuration: months('23'),
      bondedLockDuration: new BN('3600'), // 3600 seconds = 1 hour for testing
    },
    veXBE: {
      minLockDuration: new BN('3600'), // 3600 seconds = 1 hour for testing
    },
  };

  deployer.then(async () => {
    let dependentsAddresses = testnet_distro.rinkeby;
    dependentsAddresses.curve.pools =
      Object.values(dependentsAddresses.curve.pool_data);

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
        contracts.voting = await deployer.deploy(Voting, { from: owner });
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
      }
      else if (network === 'rinkeby_all_with_save') {
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
        contracts.bonusCampaign = await BonusCampaign.at('0xbce5A336944fa3c270A31bB7D148CbbF01E2C1bc');
        await contracts.bonusCampaign.configure(
          contracts.mockXBE.address,
          contracts.veXBE.address,
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
      // disable for unit tests, but enable for integration tests
      const disableDeployment = false;
      if (!disableDeployment) {
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
      }
    } else if (network === 'mainnet') {
      // await deployVaultsToMainnet();
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
