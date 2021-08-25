const { ether, BN, time } = require('@openzeppelin/test-helpers');
const { hash } = require('eth-ens-namehash');
const { getEventArgument } = require('@aragon/contract-helpers-test/src/events');
const deployment = require('./deployment.js');
const constants = require('./constants.js');
const accounts = require('./accounts.js');
const artifacts = require('./artifacts.js');
const common = require('./common.js');

const { localParams } = require('./constants.js');

let deployedAndConfiguredContracts = {};

const environment = {
  BaseKernel: async (force) => await common.cacheAndReturn('BaseKernel', force, deployedAndConfiguredContracts,
    async () => await deployment.Kernel()),
  BaseACL: async (force) => await common.cacheAndReturn('BaseACL', force, deployedAndConfiguredContracts,
    async () => await deployment.ACL()),
  Kernel: async (force) => await common.cacheAndReturn('Kernel', force, deployedAndConfiguredContracts,
    async () => {
      const daoFactory = await common.waitFor('DAOFactory', deployedAndConfiguredContracts);
      const owner = await common.waitFor('owner', accounts.people);
      const daoReceipt = await daoFactory.newDAO(
        owner,
        { from: owner },
      );
      const result = await artifacts
        .Kernel.at(getEventArgument(daoReceipt, 'DeployDAO', 'dao'));
      return result;
    }),
  ACL: async (force) => await common.cacheAndReturn('ACL', force, deployedAndConfiguredContracts,
    async () => {
      const dao = await common.waitFor(
        'Kernel', deployedAndConfiguredContracts,
      );
      const owner = await common.waitFor('owner', accounts.people);

      const acl = await artifacts.ACL.at(await dao.acl());
      const APP_MANAGER_ROLE = await dao.APP_MANAGER_ROLE();
      await acl.createPermission(
        owner,
        dao.address,
        APP_MANAGER_ROLE,
        owner,
        { from: owner },
      );
      return acl;
    }),
  EVMScriptRegistryFactory: async (force) => await common.cacheAndReturn('EVMScriptRegistryFactory', force, deployedAndConfiguredContracts,
    async () => await deployment.EVMScriptRegistryFactory()),
  DAOFactory: async (force) => await common.cacheAndReturn('DAOFactory', force, deployedAndConfiguredContracts,
    async () => await deployment.DAOFactory()),
  MockXBE: async (force) => await common.cacheAndReturn('MockXBE', force, deployedAndConfiguredContracts,
    async () => await deployment.MockXBE()),
  MockToken: async () => {
    const alice = await common.waitFor('alice', accounts.people);
    const owner = await common.waitFor('owner', accounts.people);
    const instance = await common.getMockTokenPrepared(
      alice, ether('500'), ether('1000'), owner,
    );
    return instance;
  },
  ConsumerEURxbVault: async (force) => await common.cacheAndReturn('ConsumerEURxbVault', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.ConsumerEURxbVault();
      await instance.configure(
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        (await common.waitFor(
          'Controller',
          deployment.deployedContracts,
        )).address,
        await common.waitFor('owner', accounts.people),
        constants.localParams.vaults.rewardsDuration,
        [],
        'Consumer Vault',
        'cva',
      );
      return instance;
    }),
  InstitutionalEURxbVault: async (force) => await common.cacheAndReturn('InstitutionalEURxbVault', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.ConsumerEURxbVault();
      await instance.configure(
        (await common.waitFor(
          'TokenWrapper',
          deployment.deployedContracts,
        )).address,
        (await common.waitFor(
          'Controller',
          deployment.deployedContracts,
        )).address,
        await common.waitFor('owner', accounts.people),
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        constants.localParams.vaults.rewardsDuration,
        [],
        'Institutional Vault',
        'iva',
      );
      return instance;
    }),
  HiveVault: {},
  SushiVault: async (force, overridenConfigureParams) => await common.cacheAndReturn('SushiVault', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.SushiVault();
      const owner = await common.waitFor('owner', accounts.people);
      const mockXBE = await common.waitFor(
        'MockXBE',
        deployedAndConfiguredContracts,
        'environment - waiting for MockXBE as dep for SushiVault',
      );

      const mockLpSushi = await common.waitFor(
        'MockLPSushi',
        deployedAndConfiguredContracts,
        'environment - waiting for MockLPSushi as dep for SushiVault',
      );

      const controller = await common.waitFor(
        'Controller',
        deployment.deployedContracts,
      );

      const originalConfigureParams = [
        async () => mockLpSushi.address,
        async () => controller.address,
        async () => owner,
        async () => constants.localParams.vaults.rewardsDuration,
        async () => mockXBE.address,
        async () => (await common.waitFor(
          'VotingStakingRewards',
          deployment.deployedContracts,
          'environment - waiting for VotingStakingRewards as dep for SushiVault',
        )).address,
        async () => [mockXBE.address],
        async () => 'Sushi Vault',
        async () => 'sv',
      ];
      await instance.configure(
        ...(await common.overrideConfigureArgsIfNeeded(
          originalConfigureParams,
          overridenConfigureParams,
          originalConfigureParams.length,
        )),
      );
      return instance;
    }),
  CVXVault: {},
  CvxCrvVault: {},
  InstitutionalEURxbStrategy: {},
  ConsumerEURxbStrategy: {},
  HiveStrategy: {},
  SushiStrategy: async (force) => common.cacheAndReturn('SushiStrategy', force, deployedAndConfiguredContracts,
    async () => {
      const owner = await common.waitFor('owner', accounts.people,
        'environment - waiting for owner for SushiStrategy ');

      const mockLpSushi = await common.waitFor('MockLPSushi', deployedAndConfiguredContracts,
        'environment - waiting for MockLPSushi deployed');
      const vault = await common.waitFor('SushiVault', deployedAndConfiguredContracts,
        'environment - waiting for SushiVault for SushiStrategy');

      const instance = await deployment.SushiStrategy();

      const controller = await common.waitFor('Controller', deployedAndConfiguredContracts,
        'environment - waiting for Controller for SushiStrategy');

      await instance.configure(
        mockLpSushi.address,
        controller.address,
        owner,
        (await common.waitFor('MockXBE', deployedAndConfiguredContracts,
          'environment - MockXBE as dependency for SushiStrategy')).address,
        { from: owner },
      );

      await controller.setVault(
        mockLpSushi.address,
        vault.address,
      );

      await controller.setApprovedStrategy(
        mockLpSushi.address,
        instance.address,
        true,
      );
      await controller.setStrategy(
        mockLpSushi.address,
        instance.address,
      );

      console.log('SushiStrategy configured');

      return instance;
    }),
  MockLPSushi: async (force) => common.cacheAndReturn('MockLPSushi', force, deployedAndConfiguredContracts,
    async () => {
      const mockXBE = await common.waitFor('MockXBE', deployedAndConfiguredContracts,
        'environment - MockXBE as dependency for Mock LP Sushi');

      const weth9 = await artifacts.WETH9.at(
        localParams.sushiSwapAddresses.rinkeby.weth,
      );
      const sushiSwapFactory = await artifacts.IUniswapV2Factory.at(
        localParams.sushiSwapAddresses.rinkeby.sushiswapFactory,
      );
      const sushiSwapRouter = await artifacts.IUniswapV2Router02.at(
        localParams.sushiSwapAddresses.rinkeby.sushiswapRouter,
      );
      const owner = await common.waitFor('owner', accounts.people);

      await mockXBE.mintSender(ether('1000'), { from: owner });
      await weth9.deposit({
        from: owner,
        value: localParams.sushiswapPair.wethAmountForPair,
      });

      console.log(`WETH balance ${(await weth9.balanceOf(owner)).toString()}`);

      // not required now
      await mockXBE.approve(
        sushiSwapRouter.address,
        localParams.sushiswapPair.xbeAmountForPair,
        { from: owner },
      );

      // already enough
      await weth9.approve(
        sushiSwapRouter.address,
        localParams.sushiswapPair.wethAmountForPair,
        { from: owner },
      );

      // no need to add liquidity each time
      await sushiSwapRouter.addLiquidity(
        mockXBE.address,
        weth9.address,
        localParams.sushiswapPair.xbeAmountForPair,
        localParams.sushiswapPair.wethAmountForPair,
        localParams.sushiswapPair.xbeAmountForPair,
        localParams.sushiswapPair.wethAmountForPair,
        owner,
        (await time.latest()).add(new BN('3600')),
        { from: owner },
      );
      const mockLpSushi = await artifacts.IUniswapV2Pair.at(
        await sushiSwapFactory.getPair(
          mockXBE.address,
          weth9.address,
        ),
      );
      return mockLpSushi;
    }),
  CVXStrategy: {},
  CvxCrvStrategy: {},
  Voting: async (force) => common.cacheAndReturn('Voting', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.Voting();
      await instance.initialize(
        (await common.waitFor(
          'VeXBE',
          deployment.deployedContracts,
        )).address,
        constants.localParams.voting.supportRequiredPct,
        constants.localParams.voting.minAcceptQuorumPct,
        constants.localParams.voting.voteTime,
      );

      const acl = await common.waitFor(
        'ACL',
        deployedAndConfiguredContracts,
      );

      const dao = await common.waitFor(
        'Kernel',
        deployedAndConfiguredContracts,
      );

      const owner = await common.waitFor('owner', accounts.people);
      const alice = await common.waitFor('alice', accounts.people);

      const newAppCreationReceipt = await dao.newAppInstance(
        hash('myname.aragonpm.test'),
        instance.address,
        '0x',
        false,
        { from: owner },
      );

      const { logs } = newAppCreationReceipt;
      const log = logs.find((l) => l.event === 'NewAppProxy');
      const proxiedInstanceAddress = log.args.proxy;
      const proxiedInstance = await artifacts.Voting.at(proxiedInstanceAddress);
      await proxiedInstance.initialize(
        (await common.waitFor(
          'VeXBE',
          deployment.deployedContracts,
        )).address,
        constants.localParams.voting.supportRequiredPct,
        constants.localParams.voting.minAcceptQuorumPct,
        constants.localParams.voting.voteTime,
      );

      const setOpenPermission = async (
        _rightHolder,
        _acl,
        _appAddress,
        _role,
        _rootAddress,
      ) => {
        await _acl.createPermission(
          _rightHolder, // entity (who?) - The entity or address that will have the permission.
          _appAddress, // app (where?) - The app that holds the role involved in this permission.
          _role, // role (what?) - The particular role that the entity is being assigned to in this permission.
          _rootAddress, // manager - Can grant/revoke further permissions for this role.
          { from: _rootAddress },
        );
      };

      const executorMock = await deployment.EVMScriptExecutorMock();
      const scriptRegistry = await artifacts.EVMScriptRegistry.at(
        await proxiedInstance.getEVMScriptRegistry(),
      );

      const REGISTRY_ADD_EXECUTOR_ROLE = await scriptRegistry.REGISTRY_ADD_EXECUTOR_ROLE();
      // setting permission to address
      await setOpenPermission(
        alice,
        acl,
        proxiedInstance.address,
        REGISTRY_ADD_EXECUTOR_ROLE,
        owner,
      );

      await acl.createPermission(
        alice,
        scriptRegistry.address,
        REGISTRY_ADD_EXECUTOR_ROLE,
        alice,
        { from: owner },
      );

      await scriptRegistry.addScriptExecutor(
        executorMock.address,
        { from: alice },
      );

      return proxiedInstance;
    }),
  MockContract: async (force) => await common.cacheAndReturn('MockContract', force, deployedAndConfiguredContracts,
    async () => await deployment.MockContract()),
  VotingStakingRewards: async (force, overridenConfigureParams) => await common.cacheAndReturn('VotingStakingRewards', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.VotingStakingRewards();
      const mockXBE = await common.waitFor(
        'MockXBE',
        deployedAndConfiguredContracts,
      );
      const treasury = await common.waitFor(
        'Treasury',
        deployment.deployedContracts,
      );
      const originalConfigureParams = [
        async () => treasury.address,
        async () => mockXBE.address,
        async () => mockXBE.address,
        async () => common.days('14'),
        async () => (await common.waitFor(
          'VeXBE',
          deployment.deployedContracts,
        )).address,
        async () => (await common.waitFor(
          'BonusCampaign',
          deployment.deployedContracts,
        )).address,
        async () => treasury.address,
        async () => constants.localParams.votingStakingRewards.bondedLockDuration,
        async () => [
          (
            await common.waitFor(
              'SushiVault',
              deployment.deployedContracts,
            )
          ).address,
        ],
      ];

      await instance.configure(
        ...(await common.overrideConfigureArgsIfNeeded(
          originalConfigureParams,
          overridenConfigureParams,
          originalConfigureParams.length,
        )),
      );
      return instance;
    }),

  UnwrappedToWrappedTokenConverter: {},
  WrappedToUnwrappedTokenConverter: {},

  VeXBE: async (force) => await common.cacheAndReturn('VeXBE', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.VeXBE();

      const owner = await common.waitFor('owner', accounts.people);

      await instance.configure(
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        (await common.waitFor(
          'VotingStakingRewards',
          deployment.deployedContracts,
        )).address,
        (await common.waitFor(
          'LockSubscription',
          deployment.deployedContracts,
        )).address,
        constants.localParams.veXBE.minLockDuration,
        'Voting Escrowed XBE',
        'veXBE',
        '0.0.1',
        { from: owner },
      );

      return instance;
    }),

  StakingRewards: async (force) => await common.cacheAndReturn('StakingRewards', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.StakingRewards();
      await instance.configure(
        (await common.waitFor(
          'Treasury',
          deployment.deployedContracts,
        )).address,
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        common.days('14'),
      );
      return instance;
    }),

  BonusCampaign: async (force) => await common.cacheAndReturn('BonusCampaign', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.BonusCampaign();
      const configureTime = await time.latest();
      constants.localParams.bonusCampaign.configureTime = configureTime;
      await instance.configure(
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        (await common.waitFor(
          'VeXBE',
          deployment.deployedContracts,
        )).address,
        configureTime.add(constants.localParams.bonusCampaign.startMintTime),
        configureTime.add(constants.localParams.bonusCampaign.stopRegisterTime),
        constants.localParams.bonusCampaign.rewardsDuration,
        constants.localParams.bonusCampaign.emission,
      );
      await instance.setRegistrator((
        await common.waitFor('LockSubscription', deployedAndConfiguredContracts)
      ).address);
      return instance;
    }),
  ReferralProgram: {},
  Treasury: async (force, overridenConfigureParams) => common.cacheAndReturn('Treasury', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.Treasury();

      const owner = await common.waitFor('owner', accounts.people);

      const originalConfigureParams = [
        async () => owner,
        async () => (await common.waitFor(
          'VotingStakingRewards',
          deployment.deployedContracts,
        )).address,
        async () => (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        async () => constants.localParams.dependentsAddresses.uniswap_router_02,
        async () => constants.localParams.treasury.slippageTolerance,
        async () => constants.localParams.treasury.swapDeadline,
      ];
      await instance.configure(
        ...(await common.overrideConfigureArgsIfNeeded(
          originalConfigureParams,
          overridenConfigureParams,
          originalConfigureParams.length,
        )),
      );

      return instance;
    }),
  TokenWrapper: async (force) => common.cacheAndReturn('TokenWrapper', force, deployedAndConfiguredContracts,
    async () => await deployment.TokenWrapper()),
  Registry: async (force) => await common.cacheAndReturn('Registry', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.Registry();
      const owner = await common.waitFor('owner', accounts.people);
      await instance.configure(
        owner,
      );
      return instance;
    }),
  Controller: async (force, overridenConfigureParams) => common.cacheAndReturn('Controller', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.Controller();
      const owner = await common.waitFor('owner', accounts.people);
      const bob = await common.waitFor('bob', accounts.people);

      const originalConfigureParams = [
        async () => (await common.waitFor(
          'Treasury',
          deployment.deployedContracts,
        )).address,
        async () => bob,
        async () => owner,
      ];

      await instance.configure(
        ...(await common.overrideConfigureArgsIfNeeded(
          originalConfigureParams,
          overridenConfigureParams,
          originalConfigureParams.length,
        )),
      );

      return instance;
    }),
  SimpleXBEInflation: async (force) => common.cacheAndReturn('SimpleXBEInflation', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.SimpleXBEInflation();
      await instance.configure(
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
        )).address,
        constants.localParams.simpleXBEInflation.targetMinted,
        constants.localParams.simpleXBEInflation.periodsCount,
        constants.localParams.simpleXBEInflation.periodDuration,
      );
      return instance;
    }),
  LockSubscription: async (force) => common.cacheAndReturn('LockSubscription', force, deployedAndConfiguredContracts,
    async () => {
      const instance = await deployment.LockSubscription();
      await instance.setEventSource(
        (await common.waitFor(
          'VeXBE',
          deployment.deployedContracts,
          'environment - waiting for VeXBE as dep for LockSubscription',
        )).address,
      );
      await instance.addSubscriber(
        (await common.waitFor(
          'BonusCampaign',
          deployment.deployedContracts,
          'environment - waiting for BonusCampaign as dep for LockSubscription',
        )).address,
      );
      return instance;
    }),
};

const getGroup = async (keys, filterPredicate, force, overrideConfigureParamsList) => {
  if (force) {
    deployedAndConfiguredContracts = {};
  }
  const promises = [];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] in environment) {
      const overridenParams = overrideConfigureParamsList
        ? overrideConfigureParamsList[keys[i]] : {};
      promises.push(environment[keys[i]](force, overridenParams));
    }
  }
  const contracts = await Promise.all(promises);
  const results = [];
  for (let i = 0; i < keys.length; i++) {
    if (filterPredicate(keys[i])) {
      results.push(contracts[i]);
    }
  }
  return results;
};

const defaultGroup = [
  'MockContract',
  'MockXBE',
  'MockToken',
  'SimpleXBEInflation',
  'VeXBE',
  'Controller',
  'Treasury',
  'BonusCampaign',
  'Voting',
  'Kernel',
  'ACL',
  'BaseKernel',
  'BaseACL',
  'DAOFactory',
  'EVMScriptRegistryFactory',
  'VotingStakingRewards',
  'MockLPSushi',
  'SushiVault',
  'SushiStrategy',
  'TokenWrapper',
  'Registry',
  'LockSubscription',
];

module.exports = {
  defaultGroup,
  getGroup,
  ...environment,
};
