const { ether } = require('@openzeppelin/test-helpers');
const accounts = require('./accounts');
const common = require('./common');

const getDefaultTxParams = async () => ({
  from: await common.waitFor('owner', accounts.people),
});

module.exports = {
  Kernel: async () => [true, await getDefaultTxParams()],
  ACL: async () => [await getDefaultTxParams()],
  EVMScriptRegistryFactory: async () => [await getDefaultTxParams()],
  DAOFactory: async () => [await getDefaultTxParams()],
  EVMScriptRegistry: async () => [await getDefaultTxParams()],
  ConsumerEURxbVault: async () => [await getDefaultTxParams()],
  InstitutionalEURxbVault: async () => [await getDefaultTxParams()],
  HiveVault: async () => [await getDefaultTxParams()],
  SushiVault: async () => [await getDefaultTxParams()],
  CVXVault: async () => [await getDefaultTxParams()],
  CvxCrvVault: async () => [await getDefaultTxParams()],
  InstitutionalEURxbStrategy: async () => [await getDefaultTxParams()],
  ConsumerEURxbStrategy: async () => [await getDefaultTxParams()],
  HiveStrategy: async () => [await getDefaultTxParams()],
  EVMScriptExecutorMock: async () => [await getDefaultTxParams()],
  SushiStrategy: async () => [await getDefaultTxParams()],
  CVXStrategy: async () => [await getDefaultTxParams()],
  CvxCrvStrategy: async () => [await getDefaultTxParams()],
  Voting: async () => [await getDefaultTxParams()],
  LockSubscription: async () => [await getDefaultTxParams()],
  VotingStakingRewards: async () => [await getDefaultTxParams()],
  UnwrappedToWrappedTokenConverter: async () => [await getDefaultTxParams()],
  WrappedToUnwrappedTokenConverter: async () => [await getDefaultTxParams()],
  MockContract: async () => [await getDefaultTxParams()],
  MockToken: (name = 'Mock Token', symbol = 'MT', totalSupply = ether('1000'), from) => [name, symbol, totalSupply, { from }],
  // XBEInflation: async () => [await getDefaultTxParams()],
  VeXBE: async () => [await getDefaultTxParams()],
  StakingRewards: async () => [await getDefaultTxParams()],
  BonusCampaign: async () => [await getDefaultTxParams()],
  ReferralProgram: async () => [await getDefaultTxParams()],
  Treasury: async () => [await getDefaultTxParams()],
  TokenWrapper: async () => [await getDefaultTxParams()],
  Registry: async () => [await getDefaultTxParams()],
  Controller: async () => [await getDefaultTxParams()],
  SimpleXBEInflation: async () => [await getDefaultTxParams()],
};
