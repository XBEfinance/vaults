const { BN, ether } = require('@openzeppelin/test-helpers');
const { fromAscii, asciiToHex, keccak256 } = require('web3-utils');

const YEAR = new BN('86400').mul(new BN('365'));
const ZERO = new BN('0');
const MULTIPLIER = new BN('10').pow(new BN('18'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));

const localDistro = require('../../distro.json');
const testnetDistro = require('../../rinkeby_distro.json');

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

const getParams = (distro) => {
  const dependentsAddresses = distro.rinkeby;
  dependentsAddresses.curve.pools = Object.values(dependentsAddresses
    .curve.pool_data);
  let developmentParams = {
    vaults: {
      rewardsDuration: months('12'),
    },
    sushiswapPair: {
      xbeAmountForPair: ether('2'),
      wethAmountForPair: ether('1'),
    },
    treasury: {
      slippageTolerance: new BN('9500'),
      swapDeadline: days('1'),
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
    veXBE: {
      minLockDuration: new BN('3600'),
    },
    votingStakingRewards: {
      rewardsDuration: days('7'),
      bondedLockDuration: (new BN('3600')).mul(new BN('24')),
    },
  };
  developmentParams = {
    dependentsAddresses,
    sushiSwapAddresses,
    ...developmentParams,
  };
  return developmentParams;
};

module.exports = {
  time: {
    DAY: new BN('86400'),
    HOUR: new BN('3600'),
    months,
    days,
    YEAR,
  },
  utils: {
    ZERO,
    ONE: new BN('1'),
    CONVERSION_WEI_CONSTANT: ether('1'),
    MULTIPLIER,
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    ZERO_BYTES32: '0x0000000000000000000000000000000000000000000000000000000000000000',
    MAX_UINT256: new BN('2').pow(new BN('256')).sub(new BN('1')),
    MAX_INT256: new BN('2').pow(new BN('255')).sub(new BN('1')),
    MIN_INT256: new BN('2').pow(new BN('255')).mul(new BN('-1')),
  },
  dao: {
    APP_ID: '0x1234123412341234123412341234123412341234123412341234123412341234',
    ANY_ADDRESS: '0xffffffffffffffffffffffffffffffffffffffff',
    votesRole: keccak256('CREATE_VOTES_ROLE'),
    supportRole: keccak256('MODIFY_SUPPORT_ROLE'),
    quorumRole: keccak256('MODIFY_QUORUM_ROLE'),
    scriptForTests: '0x0000000200',
  },
  localParams: getParams(localDistro),
  testnetParams: getParams(testnetDistro),
  waitingForPollingInterval: 150,
};
