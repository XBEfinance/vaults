const { BN } = require("@openzeppelin/test-helpers");
const w3u = require('web3-utils');

const days = (n) => new BN('86400').mul(new BN(n));
const months = (n) => days('30').mul(new BN(n));
const ether = (n) => new BN(w3u.toWei(n, 'ether'));
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

const deployOptions = {
  needToDeployMainContracts: true,
  needToDeployStrategies: true,
  needToAddSushiswapLiquidity: false,  // not required now
  needTomintOwnerMockXBE: false,  // enough for him
};

const configureOptions = {
  needToAddMinters: false,
  needToConfigure: {
    strategiesAndVaults: true,
    mainContracts: true,
  },
  needToStart: {
    bonusCampaign: false,
    inflation: true,
  }
};

let configurationParams = {
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
    rewardsDuration: days('7'),
    bondedLockDuration: new BN('3600'), // 3600 seconds = 1 hour for testing
  },
  veXBE: {
    minLockDuration: new BN('3600'), // 3600 seconds = 1 hour for testing
  },
};

const phase = '1.8';

const only1_8 = true;

module.exports = {
  addressStore,
  sushiSwapAddresses,
  deployOptions,
  configureOptions,
  configurationParams,
  phase,
  only1_8,
}
