const { ether } = require('@openzeppelin/test-helpers');
const accounts = require('./accounts');
const common = require('./common');

const getDefaultTxParams = async () => {
  return {
    from: await common.waitFor('owner', accounts.people)
  };
};

module.exports = {
  Kernel: async (params) => [true, await getDefaultTxParams()],
  ACL: async (params) => [await getDefaultTxParams()],
  EVMScriptRegistryFactory: async (params) => [await getDefaultTxParams()],
  DAOFactory: async (params) => [await getDefaultTxParams()],
  EVMScriptRegistry: async (params) => [await getDefaultTxParams()],
  Vault: async (params) => [params[0], params[1], await getDefaultTxParams()],
  SushiVault: async (params) => [await getDefaultTxParams()],
  CVXVault: async (params) => [await getDefaultTxParams()],
  CvxCrvVault: async (params) => [await getDefaultTxParams()],
  HiveStrategy: async (params) => [await getDefaultTxParams()],
  EVMScriptExecutorMock: async (params) => [await getDefaultTxParams()],
  SushiStrategy: async (params) => [await getDefaultTxParams()],
  CVXStrategy: async (params) => [await getDefaultTxParams()],
  CvxCrvStrategy: async (params) => [await getDefaultTxParams()],
  Voting: async (params) => [await getDefaultTxParams()],
  LockSubscription: async (params) => [await getDefaultTxParams()],
  FeeToTreasuryTransporter: async (params) => [await getDefaultTxParams()],
  VotingStakingRewards: async (params) => [await getDefaultTxParams()],
  UnwrappedToWrappedTokenConverter: async (params) => [await getDefaultTxParams()],
  WrappedToUnwrappedTokenConverter: async (params) => [await getDefaultTxParams()],
  MockContract: async (params) => [await getDefaultTxParams()],
  MockToken: async (params, name = 'Mock Token', symbol = 'MT', totalSupply = ether('1000'), from) => [name, symbol, totalSupply, { from }],
  VeXBE: async (params) => [await getDefaultTxParams()],
  StakingRewards: async (params) => [await getDefaultTxParams()],
  BonusCampaign: async (params) => [await getDefaultTxParams()],
  ReferralProgram: async (params) => [await getDefaultTxParams()],
  Treasury: async (params) => [await getDefaultTxParams()],
  TokenWrapper: async (params) => [await getDefaultTxParams()],
  Registry: async (params) => [await getDefaultTxParams()],
  Controller: async (params) => [await getDefaultTxParams()],
  SimpleXBEInflation: async (params) => [await getDefaultTxParams()],
};
