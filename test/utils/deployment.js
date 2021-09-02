const { ether, BN, time } = require('@openzeppelin/test-helpers');

const artifacts = require('./artifacts');
const accounts = require('./accounts');
const constructors = require('./constructors');
const common = require('./common');

let deployedContracts = {};

const getDeployerFuncWithDefaultConstructor = (key) => {
  return async (constructorGeneratorParams, force=true) => {
    return await common.cacheAndReturn(
      key, force, deployedContracts,
      async () => {
        const instance = await artifacts[key].new(
          ...(await constructors[key](constructorGeneratorParams)),
        );
        return instance;
      }
    );
  }
}

const mockTokenOfName = (name) => {
  return async (force=true) => {
    return common.cacheAndReturn(name, force, deployedContracts,
      async () => {
        const alice = await common.waitFor('alice', accounts.people);
        const owner = await common.waitFor('owner', accounts.people);
        const instance = await common.getMockTokenPrepared(
          alice, ether('500'), ether('1000'), owner,
        );
        return instance;
      }
    );
  }
}

module.exports = {
  Kernel: getDeployerFuncWithDefaultConstructor('Kernel'),
  ACL: getDeployerFuncWithDefaultConstructor('ACL'),
  EVMScriptRegistryFactory: getDeployerFuncWithDefaultConstructor('EVMScriptRegistryFactory'),
  EVMScriptExecutorMock: getDeployerFuncWithDefaultConstructor('EVMScriptExecutorMock'),
  DAOFactory: async (force=true) => {
    return common.cacheAndReturn('DAOFactory', force, deployedContracts,
      async () => {
        const instance = await artifacts.DAOFactory.new(
          (await common.waitFor('Kernel', deployedContracts,
            "deployment - Kernel as param in constructor of DAOFactory")).address,
          (await common.waitFor('ACL', deployedContracts,
            "deployment - ACL as param in constructor of DAOFactory")).address,
          (await common.waitFor('EVMScriptRegistryFactory', deployedContracts,
            "deployment - EVMScriptRegistryFactory as param in constructor of DAOFactory")).address,
          ...(await constructors.DAOFactory()),
        );
        return instance;
      }
    );
  },
  LockSubscription: getDeployerFuncWithDefaultConstructor('LockSubscription'),
  ConsumerEURxbVault: getDeployerFuncWithDefaultConstructor('ConsumerEURxbVault'),
  InstitutionalEURxbVault: getDeployerFuncWithDefaultConstructor('InstitutionalEURxbVault'),
  HiveVault: getDeployerFuncWithDefaultConstructor('HiveVault'),
  SushiVault: getDeployerFuncWithDefaultConstructor('SushiVault'),
  CVXVault: getDeployerFuncWithDefaultConstructor('CVXVault'),
  CvxCrvVault: getDeployerFuncWithDefaultConstructor('CvxCrvVault'),
  InstitutionalEURxbStrategy: getDeployerFuncWithDefaultConstructor('InstitutionalEURxbStrategy'),
  ConsumerEURxbStrategy: getDeployerFuncWithDefaultConstructor('ConsumerEURxbStrategy'),
  HiveStrategy: getDeployerFuncWithDefaultConstructor('HiveStrategy'),
  SushiStrategy: getDeployerFuncWithDefaultConstructor('SushiStrategy'),
  CVXStrategy: getDeployerFuncWithDefaultConstructor('CVXStrategy'),
  CvxCrvStrategy: getDeployerFuncWithDefaultConstructor('CvxCrvStrategy'),
  Voting: getDeployerFuncWithDefaultConstructor('Voting'),
  VotingStakingRewards: getDeployerFuncWithDefaultConstructor('VotingStakingRewards'),
  UnwrappedToWrappedTokenConverter: getDeployerFuncWithDefaultConstructor('UnwrappedToWrappedTokenConverter'),
  WrappedToUnwrappedTokenConverter: getDeployerFuncWithDefaultConstructor('WrappedToUnwrappedTokenConverter'),
  MockContract: getDeployerFuncWithDefaultConstructor('MockContract'),
  VeXBE: getDeployerFuncWithDefaultConstructor('VeXBE'),
  StakingRewards: getDeployerFuncWithDefaultConstructor('StakingRewards'),
  BonusCampaign: getDeployerFuncWithDefaultConstructor('BonusCampaign'),
  ReferralProgram: getDeployerFuncWithDefaultConstructor('ReferralProgram'),
  Treasury: getDeployerFuncWithDefaultConstructor('Treasury'),
  MockXBE: mockTokenOfName('MockXBE'),
  MockCVX: mockTokenOfName('MockCVX'),
  MockCRV: mockTokenOfName('MockCRV'),
  MockLPHive: mockTokenOfName('MockLPHive'),
  TokenWrapper: async (force=true) => {
    return common.cacheAndReturn('TokenWrapper', force, deployedContracts,
      async () => {
        const instance = await artifacts.TokenWrapper.new(
          "Wrapped MockXBE",
          "wXBE",
          (await common.waitFor('MockXBE', deployedContracts,
            "deployment - MockXBE in constructor of TokenWrapper")).address,
          await common.waitFor("owner", accounts.people,
            "deployment - owner address in constructor of TokenWrapper"),
          ...(await constructors.DAOFactory()),
        );
        return instance;
      }
    );
  },
  Registry: getDeployerFuncWithDefaultConstructor('Registry'),
  Controller: getDeployerFuncWithDefaultConstructor('Controller'),
  SimpleXBEInflation: getDeployerFuncWithDefaultConstructor('SimpleXBEInflation'),
  deployedContracts,
};
