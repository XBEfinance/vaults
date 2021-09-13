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

const overrideConfigureArgsIfNeeded = async (
  instance, originalConfigureParams, overridenConfigureParams
) => {
  await instance.configure(
    ...(await common.overrideConfigureArgsIfNeeded(
      originalConfigureParams,
      overridenConfigureParams,
      // originalConfigureParams.length,
    )),
  );
  return instance;
}

const environment = {
  BaseKernel: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'BaseKernel',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.Kernel()
  ),

  BaseACL: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'BaseACL',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.ACL()
  ),

  Kernel: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'Kernel',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
    }
  ),

  ACL: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'ACL',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
    }
  ),

  EVMScriptRegistryFactory: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'EVMScriptRegistryFactory',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.EVMScriptRegistryFactory()
  ),

  DAOFactory: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'DAOFactory',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.DAOFactory()
  ),

  MockXBE: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'MockXBE',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.MockXBE()
  ),

  MockCRV: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'MockCRV',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.MockCRV()
  ),

  MockCVX: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'MockCVX',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.MockCVX()
  ),

  MockLPHive: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'MockLPHive',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.MockLPHive()
  ),

  MockCvxCrv: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'MockCvxCrv',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.MockCvxCrv()
  ),

  MockToken: async () => {
    const alice = await common.waitFor('alice', accounts.people);
    const owner = await common.waitFor('owner', accounts.people);
    const instance = await common.getMockTokenPrepared(
      alice, ether('500'), ether('1000'), owner,
    );
    return instance;
  },

  ConsumerEURxbVault: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'ConsumerEURxbVault',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
    }
  ),

  InstitutionalEURxbVault: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'InstitutionalEURxbVault',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
    }
  ),

  HiveVault: async (force, overridenConfigureParams, isMockContractRequested) => await common.cacheAndReturnContract(
    'HiveVault',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.HiveVault();
      const owner = await common.waitFor('owner', accounts.people);

      const mockXBE = await common.waitFor(
        'MockXBE',
        deployedAndConfiguredContracts,
        'environment - waiting for MockXBE as dep for HiveVault',
      );

      const mockCRV = await common.waitFor(
        'MockCRV',
        deployedAndConfiguredContracts,
        'environment - waiting for MockCRV as dep for HiveVault',
      );

      const mockCVX = await common.waitFor(
        'MockCVX',
        deployedAndConfiguredContracts,
        'environment - waiting for MockCVX as dep for HiveVault',
      );

      const mockLpHive = await common.waitFor(
        'MockLPHive',
        deployedAndConfiguredContracts,
        'environment - waiting for MockLPHive as dep for HiveVault',
      );

      const controller = await common.waitFor(
        'Controller',
        deployment.deployedContracts,
        'environment - waiting for Controller as dep for HiveVault',
      );

      const hiveStrategy = await common.waitFor(
        'HiveStrategy',
        deployedAndConfiguredContracts,
        'environment - waiting for HiveStrategy as dep for HiveVault',
      );
      await instance.setRewardsDistribution(hiveStrategy.address);

      const referralProgram = await common.waitFor(
        'ReferralProgram',
        deployedAndConfiguredContracts,
        'environment - waiting for ReferralProgram as dep for HiveVault',
      );

      const treasury = await common.waitFor(
        'Treasury',
        deployedAndConfiguredContracts,
        'environment - waiting for Treasury as dep for HiveVault',
      );

      const originalConfigureParams = [
        async () => mockLpHive.address,
        async () => controller.address,
        async () => owner,
        async () => constants.localParams.vaults.rewardsDuration,
        async () => mockXBE.address,
        async () => (await common.waitFor(
          'VotingStakingRewards',
          deployment.deployedContracts,
          'environment - waiting for VotingStakingRewards as dep for HiveVault',
        )).address,
        async () => true,
        async () => owner,
        async () => referralProgram.address,
        async () => treasury.address,
        async () => [mockXBE.address, mockCVX.address, mockCRV.address],
        async () => 'Hive Vault',
        async () => 'hv',
      ];
      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  SushiVault: async (force, overridenConfigureParams, isMockContractRequested) => await common.cacheAndReturnContract(
    'SushiVault',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
        'environment - waiting for Controller as dep for SushiVault',
      );

      const sushiStrategy = await common.waitFor(
        'SushiStrategy',
        deployedAndConfiguredContracts,
        'environment - waiting for SushiStrategy as dep for SushiVault',
      );
      await instance.setRewardsDistribution(sushiStrategy.address);

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
      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  CVXVault: async (force, overridenConfigureParams, isMockContractRequested) => await common.cacheAndReturnContract(
    'CVXVault',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.CVXVault();
      const owner = await common.waitFor('owner', accounts.people);

      const mockXBE = await common.waitFor(
        'MockXBE',
        deployedAndConfiguredContracts,
        'environment - waiting for MockXBE as dep for CVXVault',
      );

      const mockCvxCrv = await common.waitFor(
        'MockCvxCrv',
        deployedAndConfiguredContracts,
        'environment - waiting for MockCvxCrv as dep for CVXVault',
      );

      const mockCVX = await common.waitFor(
        'MockCVX',
        deployedAndConfiguredContracts,
        'environment - waiting for MockCVX as dep for CVXVault',
      );

      const controller = await common.waitFor(
        'Controller',
        deployment.deployedContracts,
        'environment - waiting for Controller as dep for CVXVault',
      );

      const cvxStrategy = await common.waitFor(
        'CVXStrategy',
        deployedAndConfiguredContracts,
        'environment - waiting for CVXStrategy as dep for CVXVault',
      );
      await instance.setRewardsDistribution(cvxStrategy.address);

      const referralProgram = await common.waitFor(
        'ReferralProgram',
        deployedAndConfiguredContracts,
        'environment - waiting for ReferralProgram as dep for CVXVault',
      );

      const treasury = await common.waitFor(
        'Treasury',
        deployedAndConfiguredContracts,
        'environment - waiting for Treasury as dep for CVXVault',
      );

      const originalConfigureParams = [
        async () => mockCVX.address,
        async () => controller.address,
        async () => owner,
        async () => constants.localParams.vaults.rewardsDuration,
        async () => mockXBE.address,
        async () => (await common.waitFor(
          'VotingStakingRewards',
          deployment.deployedContracts,
          'environment - waiting for VotingStakingRewards as dep for CVXVault',
        )).address,
        async () => true,
        async () => owner,
        async () => referralProgram.address,
        async () => treasury.address,
        async () => [mockXBE.address, mockCvxCrv.address],
        async () => 'CVX Vault',
        async () => 'xc',
      ];
      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  CvxCrvVault: async (force, overridenConfigureParams, isMockContractRequested) => await common.cacheAndReturnContract(
    'CvxCrvVault',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.CvxCrvVault();
      const owner = await common.waitFor('owner', accounts.people);

      const mockXBE = await common.waitFor(
        'MockXBE',
        deployedAndConfiguredContracts,
        'environment - waiting for MockXBE as dep for CvxCrvVault',
      );

      const mockCRV = await common.waitFor(
        'MockCRV',
        deployedAndConfiguredContracts,
        'environment - waiting for MockCRV as dep for CvxCrvVault',
      );

      const mockCVX = await common.waitFor(
        'MockCVX',
        deployedAndConfiguredContracts,
        'environment - waiting for MockCVX as dep for CvxCrvVault',
      );

      const mockCvxCrv = await common.waitFor(
        'MockCvxCrv',
        deployedAndConfiguredContracts,
        'environment - waiting for MockCvxCrv as dep for CvxCrvVault',
      );

      const controller = await common.waitFor(
        'Controller',
        deployment.deployedContracts,
        'environment - waiting for Controller as dep for CvxCrvVault',
      );

      const cvxCrvStrategy = await common.waitFor(
        'CvxCrvStrategy',
        deployedAndConfiguredContracts,
        'environment - waiting for CvxCrvStrategy as dep for CvxCrvVault',
      );
      await instance.setRewardsDistribution(cvxCrvStrategy.address);

      const referralProgram = await common.waitFor(
        'ReferralProgram',
        deployedAndConfiguredContracts,
        'environment - waiting for ReferralProgram as dep for CvxCrvVault',
      );

      const treasury = await common.waitFor(
        'Treasury',
        deployedAndConfiguredContracts,
        'environment - waiting for Treasury as dep for CvxCrvVault',
      );

      const originalConfigureParams = [
        async () => mockCvxCrv.address,
        async () => controller.address,
        async () => owner,
        async () => constants.localParams.vaults.rewardsDuration,
        async () => mockXBE.address,
        async () => (await common.waitFor(
          'VotingStakingRewards',
          deployment.deployedContracts,
          'environment - waiting for VotingStakingRewards as dep for CvxCrvVault',
        )).address,
        async () => true,
        async () => owner,
        async () => referralProgram.address,
        async () => treasury.address,
        async () => [mockXBE.address, mockCVX.address, mockCRV.address],
        async () => 'CvxCrv Vault',
        async () => 'xr',
      ];
      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  ConvexBooster: async (force) => common.cacheAndReturnContract(
    'ConvexBooster',
    force,
    deployedAndConfiguredContracts,
    true
  ),

  ConvexCRVRewards: async (force) => common.cacheAndReturnContract(
    'ConvexCRVRewards',
    force,
    deployedAndConfiguredContracts,
    true
  ),

  ConvexCVXRewards: async (force) => common.cacheAndReturnContract(
    'ConvexCVXRewards',
    force,
    deployedAndConfiguredContracts,
    true
  ),

  ConvexCvxCrvRewards: async (force) => common.cacheAndReturnContract(
    'ConvexCvxCrvRewards',
    force,
    deployedAndConfiguredContracts,
    true
  ),

  ConvexCrvDepositor: async (force) => common.cacheAndReturnContract(
    'ConvexCrvDepositor',
    force,
    deployedAndConfiguredContracts,
    true
  ),

  InstitutionalEURxbStrategy: {},
  ConsumerEURxbStrategy: {},

  HiveStrategy: async (force, overridenConfigureParams, isMockContractRequested) => common.cacheAndReturnContract(
    'HiveStrategy',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {

      const instance = await deployment.HiveStrategy();

      const owner = await common.waitFor('owner', accounts.people,
        'environment - waiting for owner for HiveStrategy ');

      const mockLPHive = await common.waitFor('MockLPHive', deployedAndConfiguredContracts,
        'environment - waiting for MockLPHive deployed');
      const mockXBE = await common.waitFor('MockXBE', deployedAndConfiguredContracts,
        'environment - waiting for MockXBE deployed');
      const mockCRV = await common.waitFor('MockCRV', deployedAndConfiguredContracts,
        'environment - waiting for MockCRV deployed');
      const mockCVX = await common.waitFor('MockCVX', deployedAndConfiguredContracts,
        'environment - waiting for MockCVX deployed');

      const сonvexBooster = await common.waitFor('ConvexBooster', deployedAndConfiguredContracts,
        'environment - waiting for ConvexBooster deployed');
      const convexCRVRewards = await common.waitFor('ConvexCRVRewards', deployedAndConfiguredContracts,
        'environment - waiting for ConvexCRVRewards deployed');
      const convexCVXRewards = await common.waitFor('ConvexCVXRewards', deployedAndConfiguredContracts,
        'environment - waiting for ConvexCVXRewards deployed');

      const controller = await common.waitFor('Controller', deployedAndConfiguredContracts,
        'environment - waiting for Controller deployed');

      const originalConfigureParams = [
        async () => mockLPHive.address,
        async () => controller.address,
        async () => owner,
        async () => [
          convexCRVRewards.address,
          convexCVXRewards.address,
          сonvexBooster.address,
          constants.utils.ZERO,
          mockCRV.address,
          mockCVX.address
        ]
      ];

      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  CVXStrategy: async (force, overridenConfigureParams, isMockContractRequested) => common.cacheAndReturnContract(
    'CVXStrategy',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.CVXStrategy();

      const owner = await common.waitFor('owner', accounts.people,
        'environment - waiting for owner for CVXStrategy ');

      const convexCVXRewards = await common.waitFor('ConvexCVXRewards', deployedAndConfiguredContracts,
        'environment - waiting for ConvexCVXRewards deployed');

      const mockCVX = await common.waitFor('MockCVX', deployedAndConfiguredContracts,
        'environment - waiting for MockCVX deployed');

      const controller = await common.waitFor('Controller', deployedAndConfiguredContracts,
        'environment - waiting for Controller deployed');

      const originalConfigureParams = [
        async () => mockCVX.address,
        async () => controller.address,
        async () => owner,
        async () => [
          convexCVXRewards.address,
          constants.utils.ZERO,
        ]
      ];
      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  CvxCrvStrategy: async (force, overridenConfigureParams, isMockContractRequested) => common.cacheAndReturnContract(
    'CvxCrvStrategy',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.CvxCrvStrategy();

      const owner = await common.waitFor('owner', accounts.people,
        'environment - waiting for owner for CvxCrvStrategy ');

      const convexCvxCrvRewards = await common.waitFor('ConvexCvxCrvRewards', deployedAndConfiguredContracts,
        'environment - waiting for ConvexCvxCrvRewards deployed');

      const convexCrvDepositor = await common.waitFor('ConvexCrvDepositor', deployedAndConfiguredContracts,
        'environment - waiting for ConvexCrvDepositor deployed');

      const mockCvxCrv = await common.waitFor('MockCvxCrv', deployedAndConfiguredContracts,
        'environment - waiting for MockCvxCrv deployed');

      const mockCRV = await common.waitFor('MockCRV', deployedAndConfiguredContracts,
        'environment - waiting for MockCRV deployed');

      const controller = await common.waitFor('Controller', deployedAndConfiguredContracts,
        'environment - waiting for Controller deployed');

      const originalConfigureParams = [
        async () => mockCvxCrv.address,
        async () => controller.address,
        async () => owner,
        async () => [
          convexCvxCrvRewards.address,
          convexCrvDepositor.address,
          mockCRV.address,
        ]
      ];
      return await overrideConfigureArgsIfNeeded(
        instance,
        originalConfigureParams,
        overridenConfigureParams
      );
    }
  ),

  SushiStrategy: async (force, _, isMockContractRequested) => common.cacheAndReturnContract(
    'SushiStrategy',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const owner = await common.waitFor('owner', accounts.people,
        'environment - waiting for owner for SushiStrategy ');

      const mockLpSushi = await common.waitFor('MockLPSushi', deployedAndConfiguredContracts,
        'environment - waiting for MockLPSushi deployed');
      const vault = await common.waitFor('SushiVault', deployment.deployedContracts,
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
    }
  ),

  MockLPSushi: async (force, _, isMockContractRequested) => common.cacheAndReturnContract(
    'MockLPSushi',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
    }
  ),

  Voting: async (force, _, isMockContractRequested) => common.cacheAndReturnContract(
    'Voting',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.Voting();
      await instance.initialize(
        (await common.waitFor(
          'VeXBE',
          deployment.deployedContracts,
          'environment - waiting for VeXBE as dep for Voting'

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
          'environment - waiting for VeXBE as dep for Voting'
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
    }
  ),

  MockContract: async (force) => await common.cacheAndReturnContract(
    'MockContract',
    force,
    deployedAndConfiguredContracts,
    true
  ),

  VotingStakingRewards: async (force, overridenConfigureParams, isMockContractRequested) => await common.cacheAndReturnContract(
    'VotingStakingRewards',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
          'environment - waiting for VeXBE as dep for VotingStakingRewards'
        )).address,
        async () => (await common.waitFor(
          'BonusCampaign',
          deployment.deployedContracts,
          'environment - waiting for BonusCampaign as dep for VotingStakingRewards'
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

      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  UnwrappedToWrappedTokenConverter: {},
  WrappedToUnwrappedTokenConverter: {},

  VeXBE: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'VeXBE',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
          'environment - waiting for VotingStakingRewards as a dependency of VeXBE'
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
    }
  ),

  StakingRewards: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'StakingRewards',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
    }
  ),

  BonusCampaign: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'BonusCampaign',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
          'environment - waiting for VeXBE as dep for BonusCampaign'
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
    }
  ),

  ReferralProgram: async (
    force,
    overridenConfigureParams,
    isMockContractRequested,
    isConfigurationEnabled
  ) => common.cacheAndReturnContract(
    'ReferralProgram',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.ReferralProgram();
      if (isConfigurationEnabled) {
        const originalConfigureParams = [
          async () => [
            async () => async () => (await common.waitFor(
              'MockXBE',
              deployment.deployedContracts,
            )).address,
            async () => async () => (await common.waitFor(
              'MockCRV',
              deployment.deployedContracts,
            )).address,
            async () => async () => (await common.waitFor(
              'MockCVX',
              deployment.deployedContracts,
            )).address
          ],
          async () => async () => (await common.waitFor(
            'Treasury',
            deployedAndConfiguredContracts,
          )).address,
          async () => (await common.waitFor(
            'Registry',
            deployedAndConfiguredContracts,
          )).address
        ];
        return await overrideConfigureArgsIfNeeded(
          instance, originalConfigureParams, overridenConfigureParams
        );
      }
      return instance;
    }
  ),

  Treasury: async (force, overridenConfigureParams, isMockContractRequested) => common.cacheAndReturnContract(
    'Treasury',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.Treasury();

      const owner = await common.waitFor('owner', accounts.people);

      const originalConfigureParams = [
        async () => owner,
        async () => (await common.waitFor(
          'VotingStakingRewards',
          deployment.deployedContracts,
          'waiting for VotingStakingRewards as dependency for Treasury',
        )).address,
        async () => (await common.waitFor(
          'MockXBE',
          deployment.deployedContracts,
        )).address,
        async () => constants.localParams.dependentsAddresses.uniswap_router_02,
        async () => constants.localParams.treasury.slippageTolerance,
        async () => constants.localParams.treasury.swapDeadline,
      ];
      console.log('treasury', overridenConfigureParams);
      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  TokenWrapper: async (force, _, isMockContractRequested) => common.cacheAndReturnContract(
    'TokenWrapper',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => await deployment.TokenWrapper()
  ),

  Registry: async (force, _, isMockContractRequested) => await common.cacheAndReturnContract(
    'Registry',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      return await deployment.Registry();
    }
  ),

  Controller: async (force, overridenConfigureParams, isMockContractRequested) => common.cacheAndReturnContract(
    'Controller',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.Controller();
      const owner = await common.waitFor('owner', accounts.people);
      const bob = await common.waitFor('bob', accounts.people);

      const originalConfigureParams = [
        async () => (await common.waitFor(
          'Treasury',
          deployment.deployedContracts,
          'environment - waiting for Treasury as dep for Controller',
        )).address,
        async () => bob,
        async () => owner,
      ];
      return await overrideConfigureArgsIfNeeded(
        instance, originalConfigureParams, overridenConfigureParams
      );
    }
  ),

  SimpleXBEInflation: async (force, _, isMockContractRequested) => common.cacheAndReturnContract(
    'SimpleXBEInflation',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
    async () => {
      const instance = await deployment.SimpleXBEInflation();
      await instance.configure(
        (await common.waitFor(
          'MockXBE',
          deployedAndConfiguredContracts,
          'environment - waiting for MockXBE as dep for SimpleXBEInflation',
        )).address,
        constants.localParams.simpleXBEInflation.targetMinted,
        constants.localParams.simpleXBEInflation.periodsCount,
        constants.localParams.simpleXBEInflation.periodDuration,
      );
      return instance;
    }
  ),

  LockSubscription: async (force, _, isMockContractRequested) => common.cacheAndReturnContract(
    'LockSubscription',
    force,
    deployedAndConfiguredContracts,
    isMockContractRequested,
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
    }
  ),
};

const getGroup = async (
  keys,
  filterPredicate,
  force,
  overrideConfigureParamsDict,
  isMockContractRequestedListOfBooleans
) => {
  if (force) {
    deployedAndConfiguredContracts = {};
  }
  const promises = [];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] in environment) {
      const overridenParams = overrideConfigureParamsDict
        ? overrideConfigureParamsDict[keys[i]] : {};
      const isMockContractRequested = isMockContractRequestedListOfBooleans
        ? isMockContractRequestedListOfBooleans[keys[i]] : false;
      promises.push(environment[keys[i]](
        force,
        overridenParams,
        isMockContractRequested
      ));
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
  deployedAndConfiguredContracts,
  ...environment,
};
