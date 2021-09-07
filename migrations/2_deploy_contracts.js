const { assert } = require('chai');
const { BN, constants, time } = require('@openzeppelin/test-helpers');

const fs = require('fs');
const testnet_distro = require('../../curve-convex/distro.json');
// const { sushiSwapAddresses } = require("./utils/configuration.js");

const SimpleXbeInflation = artifacts.require('SimpleXBEInflation');
const BonusCampaign = artifacts.require('BonusCampaign');

const Registrator = artifacts.require('LockSubscription');
const VeXBE = artifacts.require('VeXBE');
const VotingStakingRewards = artifacts.require('VotingStakingRewards');

const SushiStrategy = artifacts.require('SushiStrategy');
const SushiVault = artifacts.require('SushiVault');

const Treasury = artifacts.require('Treasury');
const Registry = artifacts.require('Registry');
const Controller = artifacts.require('Controller');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const hours = (n) => new BN('3600').mul(new BN(n));
const months = (n) => days('30').mul(new BN(n));
const getTotalSecondsBN = () => new BN(Date.now() / 1000);
const ZERO = new BN('0');
const { ZERO_ADDRESS } = constants;

// 1.10
const HiveStrategy = artifacts.require('HiveStrategy');
const HiveVault = artifacts.require('HiveVault');
const CVXStrategy = artifacts.require('CVXStrategy');
const CVXVault = artifacts.require('CVXVault');
const CvxCrvStrategy = artifacts.require('CvxCrvStrategy');
const CvxCrvVault = artifacts.require('CvxCrvVault');
const ReferralProgram = artifacts.require('ReferralProgram');

const addressStore = {
  rinkeby: {
    sushiswap: {
      router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    },
    xbe: '0x8ce5F9558e3E0cd7dE8bE15a93DffABEC83E314e',
    pairXBE: '0xe4aAB3d3Fc1893D7e74AF2a11C69bfD5598632D1',
  },
  mainnet: {
    sushiswap: {
      router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    xbe: '0x5DE7Cc4BcBCa31c473F6D2F27825Cfb09cc0Bb16',
    pairXBE: '0x1D46AC355F9f338D9EDEa6C072120abE90D67BeE',
  },
};

let contracts = {};

const wrapAddress = (value) => (typeof value === 'undefined') ? '' : value.address;

const saveAddresses = () => {
  const jsonAddressData = JSON.stringify({
    // 1.8 contracts
    xbeInflation: wrapAddress(contracts['xbeInflation']),
    registrator: wrapAddress(contracts['registrator']),
    bonusCampaign: wrapAddress(contracts['bonusCampaign']),
    veXBE: wrapAddress(contracts['veXBE']),
    votingStakingRewards: wrapAddress(contracts['votingStakingRewards']),
    registry: wrapAddress(contracts['registry']),
    treasury: wrapAddress(contracts['treasury']),
    controller: wrapAddress(contracts['controller']),
    sushiStrategy: wrapAddress(contracts['sushiStrategy']),
    sushiVault: wrapAddress(contracts['sushiVault']),

    // 1.10 contracts
    referralProgram: wrapAddress(contracts['referralProgram']),
    hiveStrategy: wrapAddress(contracts['hiveStrategy']),
    hiveVault: wrapAddress(contracts['hiveVault']),
    cvxStrategy: wrapAddress(contracts['cvxStrategy']),
    cvxVault: wrapAddress(contracts['cvxVault']),
    cvxCrvStrategy: wrapAddress(contracts['cvxCrvStrategy']),
    cvxCrvVault: wrapAddress(contracts['cvxCrvVault']),
  });

  fs.writeFileSync('addresses.json', jsonAddressData);
};

const getSavedAddress = (key) => {
  const addressesJson = fs.readFileSync('addresses.json');
  return JSON.parse(addressesJson)[key];
};

const contractsToDeploy = new Map( // map: key => artifact
  [
    [ 'registry',             Registry ],
    [ 'treasury',             Treasury ],
    [ 'controller',           Controller ],
    [ 'xbeInflation',         SimpleXbeInflation ],
    [ 'registrator',          Registrator ],
    [ 'bonusCampaign',        BonusCampaign ],
    [ 'veXBE',                VeXBE ],
    [ 'votingStakingRewards', VotingStakingRewards ],
    [ 'sushiStrategy',        SushiStrategy ],
    [ 'sushiVault',           SushiVault ],
    [ 'hiveStrategy',         HiveStrategy ],
    [ 'hiveVault',            HiveVault ],
    [ 'cvxStrategy',          CVXStrategy ],
    [ 'cvxVault',             CVXVault ],
    [ 'cvxCrvStrategy',       CvxCrvStrategy ],
    [ 'cvxCrvVault',          CvxCrvVault ],
    [ 'referralProgram',      ReferralProgram ] ],
);

const deployContracts = async (deployer, owner) => {
  const deploySingleContract = async (contractName, artifact) => {
    const contractAddress = getSavedAddress(contractName);
    // console.log(`contract address for ${contractName} is ${contractAddress}`, `type of is ${typeof contractAddress}`);
    const needToDeployContract =
      (typeof contractAddress) === 'undefined' || contractAddress.toString().length === 0;

    if (needToDeployContract) {
      console.log(`deploying ${contractName}`);
      contracts[contractName] = await deployer.deploy(artifact, { from: owner });
      console.log(`${contractName} deployed. Address: `, contracts[contractName].address);
      saveAddresses();
    } else {
      contracts[contractName] = await artifact.at(contractAddress);
      console.log(`contract ${contractName} already deployed at ${contractAddress}, skipping`);
      saveAddresses();
    }
  }

  for await (const [key, value] of contractsToDeploy) {
    await deploySingleContract(key, value);
  }
};

const loadContracts = async () => {
  console.log('Loading contracts...');
  for await (const [contractName, artifact] of contractsToDeploy) {
    const contractAddress = getSavedAddress(contractName);
    assert((typeof contractAddress) !== 'undefined');
    assert(contractAddress.toString().length > new BN('0'));

    const instance = await artifact.at(contractAddress);
    assert((typeof instance) !== 'undefined');
    contracts[contractName] = instance;

    console.log('contract', contractName, 'loaded at', contractAddress);
  }
};

const strategiesAndVaults = (network, owner, params) => {
  const { dependentsAddresses } = params;
  return [{
    name: 'sushi',
    vault: contracts.sushiVault,
    strategy: contracts.sushiStrategy,
    strategyConfigArgs: [
      addressStore[network].pairXBE,          // _wantAddress,
      contracts.controller.address,           // _controllerAddress,
      owner,                                  // _governance,
      addressStore[network].xbe,
    ],
    vaultConfigArgs: [
      addressStore[network].pairXBE,          // _initialToken
      contracts.controller.address,           // _initialController
      owner,                                  // _governance
      params.sushiVault.rewardsDuration,      // _rewardsDuration
      addressStore[network].xbe,              // _tokenToAutostake
      contracts.votingStakingRewards.address, // _votingStakingRewards
      [ // _rewardTokens
        addressStore[network].xbe,
      ],
      'SH', // _namePostfix
      'SH', // _symbolPostfix
    ],
    token: addressStore[network].pairXBE,
  },
    {
      name: 'hive',
      vault: contracts.hiveVault,
      strategy: contracts.hiveStrategy,
      strategyConfigArgs: [
        dependentsAddresses.convex.pools[0].lptoken, // _wantAddress,
        contracts.controller.address,                // _controllerAddress,
        owner,                                       // _governance,
        // _poolSettings
        [
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
        params.hiveVault.rewardsDuration,             // _rewardsDuration
        addressStore[network].xbe,                    // tokenToAutostake,
        contracts.votingStakingRewards.address,       // votingStakingRewards,
        true,                                         // enableFees ? false
        owner,                                        // teamWallet ? address(0) ?
        contracts.referralProgram.address,            // _referralProgram
        contracts.treasury.address,                   // _treasury
        [                                             // _rewardTokens
          dependentsAddresses.curve.CRV,
          dependentsAddresses.convex.cvx, // ???????
          addressStore[network].xbe,
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
        // _poolSettings
        [
          dependentsAddresses.convex.cvxCrvRewards,                       // cvxCRVRewards
          dependentsAddresses.convex.crvDepositor,                        // crvDepositor
          dependentsAddresses.curve.CRV,                                  // crvToken
        ],
      ],
      vaultConfigArgs: [
        dependentsAddresses.convex.cvxCrv,      // _initialToken
        contracts.controller.address,           // _initialController
        owner,                                  // _governance
        params.cvxCrvVault.rewardsDuration,       // _rewardsDuration
        addressStore[network].xbe,              // tokenToAutostake,
        contracts.votingStakingRewards.address, // votingStakingRewards,
        true,                                   // enableFees ? false
        owner,                                  // teamWallet ? address(0) ?
        contracts.referralProgram.address,      // _referralProgram
        contracts.treasury.address,             // _treasury
        [ // _rewardTokens
          dependentsAddresses.convex.cvxCrv,    // ???????
          addressStore[network].xbe,
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
          ZERO,                                 // poolIndex
        ],
      ],
      token: dependentsAddresses.convex.cvx,
      vaultConfigArgs: [
        dependentsAddresses.convex.cvx,         // _initialToken
        contracts.controller.address,           // _initialController
        owner,                                  // _governance
        params.cvxVault.rewardsDuration,        // _rewardsDuration
        addressStore[network].xbe,              // tokenToAutostake,
        contracts.votingStakingRewards.address, // votingStakingRewards,
        true,                                   // enableFees ? false
        owner,                                  // teamWallet ? address(0) ?
        contracts.referralProgram.address,      // _referralProgram
        contracts.treasury.address,             // _treasury
        [ // _rewardTokens
          dependentsAddresses.convex.cvxCrv, // ???????
          addressStore[network].xbe,
        ],
        'XC', // _namePostfix
        'XC', // _symbolPostfix
      ],
    },
  ];
};

const configureSome = async (owner, network, params) => {
  await loadContracts();

  console.log('Starting configuration...');

  const tokenAddresses = [
    addressStore[network].xbe,
    dependentsAddresses.convex.cvx,
    dependentsAddresses.convex.cvxCrv
  ];

  await contracts.referralProgram.configure(
    tokenAddresses,
    contracts.treasury.address, // root address
    contracts.registry.address, // registry to get fee distributors list
    { from: owner },
  );

  console.log('ReferralProgram configured...');
};

const configureContracts = async (owner, network, params) => {
  await loadContracts();

  // const addXBEMinter = async (minter, owner) => {
  //   if (!await contracts.xbe.getMinters(minter)) {
  //     await contracts.xbe.addMinter(minter, {from: owner});
  //   }
  // };
  // add XBE minters! in mainnet
  // await addXBEMinter(contracts.bonusCampaign.address, owner);
  // await addXBEMinter(contracts.xbeInflation.address, owner);

  console.log('Starting configuration...');

  console.log('Vaults and Strategies configuration...');
  for (const item of strategiesAndVaults(network, owner, params)) {
    console.log(`Configuring ${item.name}...`);

    await contracts.controller.setVault(
      item.token,
      item.vault.address,
      {from: owner},
    );
    console.log('Controller: vault added...');

    await contracts.controller.setApprovedStrategy(
      item.token,
      item.strategy.address,
      true,
      {from: owner},
    );
    console.log('Controller: strategy approved...');

    await contracts.controller.setStrategy(
      item.token,
      item.strategy.address,
      {from: owner},
    );
    console.log('Controller: strategy added...');

    await item.strategy.configure(
      ...item.strategyConfigArgs,
      {from: owner},
    );
    console.log(`${item.name}Strategy: configured`);

    await item.vault.configure(
      ...item.vaultConfigArgs,
      {from: owner},
    );
    console.log(`${item.name}Vault: configured`);

    await item.vault.setRewardsDistribution(
      item.strategy.address,
      {from: owner},
    );
    console.log(`${item.name}Vault: setRewardsDistribution`);

    await contracts.registry.addVault(
      item.vault.address,
      {from: owner},
    );
    console.log(`${item.name}Vault: add to registry`);
  }
  console.log('All vaults and strategies have been configured...');

  await contracts.referralProgram.configure(
    [
      addressStore[network].xbe,
      dependentsAddresses.convex.cvx,
      dependentsAddresses.convex.cvxCrv
    ],
    contracts.treasury.address,
    contracts.registry.address,
    { from: owner },
  );

  console.log('ReferralProgram configured...');

  console.log('Registry configured...');

  await contracts.treasury.configure(
    owner,
    contracts.votingStakingRewards.address,
    addressStore[network].xbe,
    addressStore[network].sushiswap.router,
    params.treasury.slippageTolerance,
    params.treasury.swapDeadline,
    { from: owner },
  );
  console.log('Treasury configured...');

  await contracts.controller.configure(
    contracts.treasury.address, // _initialTreasury
    owner,                      // _initialStrategist
    owner,                      // _governance
    { from: owner },
  );
  console.log('Controller configured...');

  contracts.xbeInflation.configure(
    addressStore[network].xbe,                // _token
    params.simpleXBEInflation.targetMinted,   // _targetMinted
    params.simpleXBEInflation.periodsCount,   // _periodsCount
    params.simpleXBEInflation.periodDuration, // _periodDuration
    { from: owner },
  );
  console.log('XBEInflation: configured');

  await contracts.xbeInflation.setXBEReceiver(
    contracts.sushiStrategy.address,
    params.simpleXBEInflation.sushiWeight,
    { from: owner },
  );
  console.log('weight sushi', (await contracts.xbeInflation.weights(contracts.sushiStrategy.address)).toString());

  // instead of VotingStakingRewards: reward -> treasury -> votingStakingRewards
  await contracts.xbeInflation.setXBEReceiver(
    contracts.treasury.address,
    params.simpleXBEInflation.treasuryWeight,
    { from: owner },
  );
  console.log('weight treasury', (await contracts.xbeInflation.weights(contracts.treasury.address)).toString());
  console.log('sumWeights', (await contracts.xbeInflation.sumWeight()).toString());

  {
    const now = getTotalSecondsBN();
    await contracts.bonusCampaign.configure(
      addressStore[network].xbe,
      contracts.veXBE.address,
      now.add(params.bonusCampaign.startMintDuration),
      now.add(params.bonusCampaign.stopRegisterDuration),
      params.bonusCampaign.rewardsDuration,
      params.bonusCampaign.emission,
      { from: owner },
    );
  }

  await contracts.bonusCampaign.setRegistrator(contracts.registrator.address, { from: owner });

  // await contracts.bonusCampaign.startMint({ from: owner });
  console.log('BonusCampaign: configured');

  await contracts.veXBE.configure(
    addressStore[network].xbe,
    contracts.votingStakingRewards.address,
    contracts.registrator.address,
    params.veXBE.minLockDuration,
    'Voting Escrowed XBE',
    'veXBE',
    '1.0.1',
    { from: owner },
  );

  console.log('registrator address', contracts.registrator.address);
  await contracts.registrator.addSubscriber(contracts.bonusCampaign.address, { from: owner });
  await contracts.registrator.setEventSource(contracts.veXBE.address, { from: owner });
  console.log('VeXBE: configured...');

  await contracts.votingStakingRewards.configure(
    contracts.treasury.address,
    addressStore[network].xbe,
    addressStore[network].xbe,
    params.votingStakingRewards.rewardsDuration,
    contracts.veXBE.address,
    contracts.bonusCampaign.address, // works as a boost logic provider for now
    contracts.treasury.address, // to send remaining shares
    params.votingStakingRewards.bondedLockDuration,
    [
      contracts.sushiVault.address,
    ],
  );
  console.log('VotingStakingRewards: configured...');

  // mint inflation
  await contracts.xbeInflation.mintForContracts({ from: owner });
  console.log('Configuration completed!..');
};

module.exports = function (deployer, network) {
  const owner = process.env.DEPLOYER_ACCOUNT;

  const params = {
    sushiVault: {
      rewardsDuration: days('7'),
    },
    hiveVault: {
      rewardsDuration: days('7'),
    },
    cvxVault: {
      rewardsDuration: days('7'),
    },
    cvxCrvVault: {
      rewardsDuration: days('7'),
    },
    treasury: {
      slippageTolerance: new BN('9700'),
      swapDeadline: new BN('1800'),
    },
    bonusCampaign: {
      rewardsDuration: months('6'),
      emission: ether('5000'),
      stopRegisterDuration: days('30'),
      startMintDuration: months('18'),
    },
    simpleXBEInflation: {
      targetMinted: ether('10000'),
      periodsCount: new BN('52'),
      periodDuration: new BN('604800'),
      sushiWeight: new BN('7500'),
      treasuryWeight: new BN('2500'),
    },
    votingStakingRewards: {
      rewardsDuration: days('7'),
      bondedLockDuration: days('5'),
    },
    veXBE: {
      minLockDuration: days('7').sub(hours('1')),
    },
  };

  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage' || network === 'development' || network === 'mainnet_fork') {
      // const { exec } = require('child_process');
      // exec('cd ../curve-convex && npm run deploy && npm run generate-distro && cd ../yeur', (error, stdout, stderr) => {
      //   // console.log(`stdout: ${stdout}`);
      //   // console.log(`stderr: ${stderr}`);
      //   if (error !== null) {
      //     // console.log(`exec error: ${error}`);
      //   }
      // });
      // await deployContracts(deployer, owner);
      // await configureContracts(params, owner);
    } else if (network.startsWith('rinkeby')) {
      if (network === 'rinkeby_deploy') {
        await deployContracts(deployer, owner);
      } else if (network === 'rinkeby_configure') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        const combinedParams = {
          dependentsAddresses,
          ...params,
        };
        await configureContracts(owner, 'rinkeby', combinedParams);
      } else if (network === 'rinkeby_configure_some') {
        dependentsAddresses = testnet_distro.rinkeby;
        dependentsAddresses.curve.pools = Object.values(dependentsAddresses
          .curve.pool_data);
        const combinedParams = {
          dependentsAddresses,
          ...params,
        };
        await configureSome(owner, 'rinkeby', combinedParams);
      } else {
        console.error(`Unsupported network: ${network}`);
      }
    } else if (network.startsWith('mainnet')) {
      if (network === 'mainnet_deploy') {
        await deployContracts(deployer, owner);
      } else if (network === 'mainnet_configure') {
        await configureContracts(owner, 'mainnet', params);
      } else {
        console.error(`Unsupported network: ${network}`);
      }
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
