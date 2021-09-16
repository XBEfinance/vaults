const testnet_distro = require('../../../curve-convex/rinkeby_distro.json');
const dependentsAddresses = testnet_distro.rinkeby;
dependentsAddresses.curve.pools = Object.values(dependentsAddresses
  .curve.pool_data);
const params = { dependentsAddresses, ...params };

const { dependentsAddresses } = params;

mockXBE = await MockToken.at(getSavedAddress('mockXBE'));
xbeInflation = await XBEInflation.at(getSavedAddress('xbeInflation'));
bonusCampaign = await BonusCampaign.at(getSavedAddress('bonusCampaign'));
veXBE = await VeXBE.at(getSavedAddress('veXBE'));
voting = await Voting.at(getSavedAddress('voting'));

referralProgram = await ReferralProgram.at(getSavedAddress('referralProgram'));
registry = await Registry.at(getSavedAddress('registry'));
treasury = await Treasury.at(getSavedAddress('treasury'));
controller = await Controller.at(getSavedAddress('controller'));
hiveVault = await Vault.at(getSavedAddress('hiveVault'));
hiveStrategy = await HiveStrategy.at(getSavedAddress('hiveStrategy'));

const now = await time.latest();

console.log('Starting configuration...');

await referralProgram.configure(
  [mockXBE.address, dependentsAddresses.convex.cvx, dependentsAddresses.convex.cvxCrv],
  treasury.address,
  { from: owner },
);

console.log('ReferralProgram configured...');

await registry.configure(
  owner,
  { from: owner },
);

console.log('Registry configured...');

await treasury.configure(
  voting.address,
  voting.address,
  mockXBE.address,
  dependentsAddresses.uniswap_router_02,
  dependentsAddresses.uniswap_factory,
  params.treasury.slippageTolerance,
  now.add(params.treasury.swapDeadline),
  { from: owner },
);

console.log('Treasury configured...');

await controller.configure(
  treasury.address,
  owner,
  owner,
  { from: owner },
);

console.log('Controller configured...');

await controller.setVault(
  dependentsAddresses.convex.pools[0].lptoken,
  hiveVault.address,
  { from: owner },
);

console.log('Controller: vault added...');

await controller.setApprovedStrategy(
  dependentsAddresses.convex.pools[0].lptoken,
  hiveStrategy.address,
  true,
  { from: owner },
);

console.log('Controller: strategy approved...');

await controller.setStrategy(
  dependentsAddresses.convex.pools[0].lptoken,
  hiveStrategy.address,
  { from: owner },
);

console.log('Controller: strategy added...');
// "0x252c40Ba1295277F993d91F649644C4eF72C708D"
console.log(dependentsAddresses);

await hiveStrategy.configure(
  dependentsAddresses.curve.address_provider,
  dependentsAddresses.convex.pools[0].lptoken,
  controller.address,
  hiveVault.address,
  owner,
  [
    dependentsAddresses.curve.pool_data.mock_pool.swap_address,
    dependentsAddresses.curve.pool_data.mock_pool.lp_token_address,
    dependentsAddresses.convex.pools[0].crvRewards,
    dependentsAddresses.convex.pools[0].token,
    dependentsAddresses.convex.booster,
    dependentsAddresses.curve.pool_data.mock_pool.coins.length,
  ],
  { from: owner },
);

console.log('HiveStrategy configured...');

await xbeInflation.configure(
  mockXBE.address,
  params.xbeinflation.initialSupply,
  params.xbeinflation.initialRate,
  params.xbeinflation.rateReductionTime,
  params.xbeinflation.rateReductionCoefficient,
  params.xbeinflation.rateDenominator,
  params.xbeinflation.inflationDelay,
  { from: owner },
);

console.log('XBEInflation: configured');

await bonusCampaign.configure(
  mockXBE.address,
  veXBE.address,
  now.add(params.bonusCampaign.startMintTime),
  now.add(params.bonusCampaign.stopRegisterTime),
  params.bonusCampaign.rewardsDuration,
  params.bonusCampaign.emission,
  { from: owner },
);

console.log('BonusCampaign: configured');

await veXBE.configure(
  mockXBE.address,
  'Voting Escrowed XBE',
  'veXBE',
  '0.0.1',
  { from: owner },
);

console.log('VeXBE: configured...');

await voting.initialize(
  veXBE.address,
  params.voting.supportRequiredPct,
  params.voting.minAcceptQuorumPct,
  params.voting.voteTime,
  { from: owner },
);

console.log('Voting: configured...');

const mainRegistryAddress = await (
  await IAddressProvider.at(dependentsAddresses.curve.address_provider)
)
  .get_registry({ from: owner });

console.log(mainRegistryAddress);
await hiveStrategy.setMainRegistry(
  mainRegistryAddress,
  { from: owner },
);

console.log('HiveStrategy: main registry setup...');

await hiveVault.configure(
  dependentsAddresses.convex.pools[0].lptoken,
  controller.address,
  owner,
  referralProgram.address,
  treasury.address,
  { from: owner },
);

console.log('HiveVault: configured');
