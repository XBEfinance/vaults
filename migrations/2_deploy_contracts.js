const { BN, constants } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const XBEInflation = artifacts.require("XBEInflation");
const VeXBE = artifacts.require("VeXBE");
const Voting = artifacts.require("Voting");
const StakingRewards = artifacts.require("StakingRewards");
const BonusCampaign = artifacts.require("BonusCampaign");

const MockToken = artifacts.require('MockToken');

const Treasury = artifacts.require('Treasury');
// const XBE = artifacts.require('XBE');
const TokenWrapper = artifacts.require('TokenWrapper');
const Registry = artifacts.require('Registry');
const Controller = artifacts.require('Controller');
const ConsumerEURxbVault = artifacts.require('ConsumerEURxbVault');
const InstitutionalEURxbVault = artifacts.require('InstitutionalEURxbVault');
const UnwrappedToWrappedTokenConverter = artifacts.require('UnwrappedToWrappedTokenConverter');
const WrappedToUnwrappedTokenConverter = artifacts.require('WrappedToUnwrappedTokenConverter');
const InstitutionalEURxbStrategy = artifacts.require('InstitutionalEURxbStrategy');
const ConsumerEURxbStrategy = artifacts.require('ConsumerEURxbStrategy');


let fs = require('fs');
const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days("30").mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));
const ONE = new BN('1');
const ZERO = new BN('0');
//

let mockXBE;
let mockCRV;
let xbeInflation;
let bonusCampaign;
let veXBE;
let voting;

const saveAddresses = () => {
  let jsonAddressData = JSON.stringify({
    mockXBE: mockXBE.address,
    mockCRV: mockCRV.address,
    vaultWithXBExCRVStrategy: vaultWithXBExCRVStrategy.address,
    xbeInflation: xbeInflation.address,
    bonusCampaign: bonusCampaign.address,
    veXBE: veXBE.address,
    voting: voting.address
  });
  fs.writeFileSync("addresses.json", jsonAddressData);
};

const getSavedAddress = (key) => {
  addressesJson = fs.readFileSync("addresses.json");
  return JSON.parse(addressesJson)[key];
};

const deployContracts = async (deployer, params, owner) => {
  mockXBE = await deployer.deploy(
      MockToken,
      "Mock XBE",
      "mXBE",
      params.mockTokens.mockedTotalSupplyXBE,
      {from: owner}
  );

  mockCRV = await deployer.deploy(
      MockToken,
      "Mock CRV",
      "mCRV",
      params.mockTokens.mockedTotalSupplyCRV,
      {from: owner}
  );

  vaultWithXBExCRVStrategy = await deployer.deploy(
      MockToken,
      "Mock Vault LP Token",
      "mLP",
      params.mockTokens.mockedTotalSupplyXBE,
      {from: owner}
  );

  // deploy bonus campaign xbeinflation
  xbeInflation = await deployer.deploy(XBEInflation, {from: owner});

  // deploy bonus campaign
  bonusCampaign = await deployer.deploy(BonusCampaign, {from: owner});

  // deploy voting escrow
  veXBE = await deployer.deploy(VeXBE, {from: owner});

  // deploy voting
  voting = await deployer.deploy(Voting, {from: owner});

  saveAddresses();

};

const distributeTokens = async (params, alice, bob, owner) => {

  mockXBE = await MockToken.at(getSavedAddress("mockXBE"));
  mockCRV = await MockToken.at(getSavedAddress("mockCRV"));
  vaultWithXBExCRVStrategy = await MockToken.at(getSavedAddress("vaultWithXBExCRVStrategy"));

  // LP, XBE and CRV to alice
  await mockXBE.approve(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockCRV.approve(alice, params.mockTokens.mockedAmountCRV, {
    from: owner,
  });
  await mockCRV.transfer(alice, params.mockTokens.mockedAmountCRV, {
    from: owner,
  });
  await vaultWithXBExCRVStrategy.approve(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await vaultWithXBExCRVStrategy.transfer(alice, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });

  // LP, XBE and CRV to bob
  await mockXBE.approve(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockXBE.transfer(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await mockCRV.approve(bob, params.mockTokens.mockedAmountCRV, {
    from: owner,
  });
  await mockCRV.transfer(bob, params.mockTokens.mockedAmountCRV, {
    from: owner,
  });
  await vaultWithXBExCRVStrategy.approve(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
  await vaultWithXBExCRVStrategy.transfer(bob, params.mockTokens.mockedAmountXBE, {
    from: owner,
  });
};

const configureContracts = async (params, owner) => {

  mockXBE = await MockToken.at(getSavedAddress("mockXBE"));
  mockCRV = await MockToken.at(getSavedAddress("mockCRV"));
  vaultWithXBExCRVStrategy = await MockToken.at(getSavedAddress("vaultWithXBExCRVStrategy"));
  xbeInflation = await XBEInflation.at(getSavedAddress("xbeInflation"));
  bonusCampaign = await BonusCampaign.at(getSavedAddress("bonusCampaign"));
  veXBE = await VeXBE.at(getSavedAddress("veXBE"));
  voting = await Voting.at(getSavedAddress("voting"));

  await xbeInflation.configure(
    mockXBE.address,
    minter.address,
    params.xbeinflation.initialSupply,
    params.xbeinflation.initialRate,
    params.xbeinflation.rateReductionTime,
    params.xbeinflation.rateReductionCoefficient,
    params.xbeinflation.rateDenominator,
    params.xbeinflation.inflationDelay
  );

  await bonusCampaign.methods[
    "configure(address,address,uint256,uint256,uint256)"
  ](
    mockXBE.address,
    veXBE.address,
    params.bonusCampaign.rewardsDuration,
    params.bonusCampaign.mintTime,
    params.bonusCampaign.emission
  );

  await veXBE.configure(
    mockXBE.address,
    "Voting Escrowed XBE",
    "veXBE",
    "0.0.1"
  );

  await voting.initialize(
    veXBE.address,
    params.voting.supportRequiredPct,
    params.voting.minAcceptQuorumPct,
    params.voting.voteTime
  );
};

const deployVaults = async () => {
  const xbEuro = await MockToken.at('0x5640D0FfB20F700ebaE1e2E09D525e4C46153D8e'); // BankTransparentProxy
  const treasury = await Treasury.at('0x8D77234fC07167380fE0b776342B9bB4f46cE4a4');
  const iStrategy = await deployer.deploy(InstitutionalEURxbStrategy);
  const cStrategy = await deployer.deploy(ConsumerEURxbStrategy);
  const wXBEuro = await deployer.deploy(TokenWrapper, 'wXBEuro', 'wbEuro', xbEuro.address, iStrategy.address);
  const controller = await deployer.deploy(Controller);
  await controller.configure(treasury.address, process.env.RINKEBY_STRATEGIST);
  const registry = await deployer.deploy(Registry);
  const cVault = await deployer.deploy(ConsumerEURxbVault);
  const iVault = await deployer.deploy(InstitutionalEURxbVault);
  const eToW = await deployer.deploy(UnwrappedToWrappedTokenConverter);
  eToW.configure(xbEuro.address);
  const wToE = await deployer.deploy(WrappedToUnwrappedTokenConverter);
  wToE.configure(xbEuro.address);
  console.log('1');
  await iStrategy.configure(wXBEuro.address, controller.address, iVault.address);
  console.log('2');
  await cStrategy.configure(xbEuro.address, controller.address, cVault.address);
  console.log('3');
  const MINTER_ROLE = await wXBEuro.MINTER_ROLE();
  console.log('4');
  await wXBEuro.grantRole(MINTER_ROLE, eToW.address);
  console.log('5');
  await wXBEuro.grantRole(MINTER_ROLE, wToE.address);
  console.log('6');
  await cVault.configure(xbEuro.address, controller.address);
  console.log('7');
  await iVault.configure(wXBEuro.address, controller.address);
  console.log('8');
  await controller.setApprovedStrategy(xbEuro.address, cStrategy.address, true);
  console.log('9');
  await controller.setApprovedStrategy(wXBEuro.address, iStrategy.address, true);
  console.log('10');
  await controller.setStrategy(xbEuro.address, cStrategy.address);
  console.log('11');
  await controller.setStrategy(wXBEuro.address, iStrategy.address);
  console.log('12');
  await controller.setConverter(iVault.address, xbEuro.address, wToE.address);
  console.log('13');
  await controller.setConverter(xbEuro.address, iVault.address, eToW.address);
  console.log('14');
  await controller.setVault(xbEuro.address, cVault.address);
  console.log('15');
  await controller.setVault(wXBEuro.address, iVault.address);
  console.log('16');
  await registry.addVault(cVault.address);
  console.log('17');
  await registry.addVault(iVault.address);
  console.log('18');


  // const xbe = await XBE.at('0xfaC2D38F064A35b5C0636a7eDB4B6Cc13bD8D278');
  // const governance = await deployer.deploy(Governance);
  // const treasury = await deployer.deploy(Treasury);

  // await governance.configure(
  //   '0',
  //   xbe.address, // Reward token
  //   process.env.RINKEBY_OWNER_ACCOUNT,
  //   xbe.address, // Governance token
  //   process.env.REWARD_DISTRIBUTION_RINKEBY_ACCOUNT, // if treasury contract is exist then change that to treasury.address
  // );
  // await treasury.configure(
  //   process.env.RINKEBY_OWNER_ACCOUNT,
  //   '0x0000000000000000000000000000000000000000', // testnet OneSplit account
  //   governance.address,
  //   xbe.address, // Reward token
  // );
};

const deployVaultsToMainnet = async () => {
  // const xbe = await XBE.at('0x5DE7Cc4BcBCa31c473F6D2F27825Cfb09cc0Bb16');
  // const governance = await deployer.deploy(Governance);
  // // const treasury = await deployer.deploy(Treasury);
  //
  // await governance.configure(
  //   '0',
  //   xbe.address, // Reward token
  //   process.env.MAINNERT_OWNER_ACCOUNT,
  //   xbe.address, // Governance token
  //   process.env.MAINNERT_DISTRIBUTION_RINKEBY_ACCOUNT, // if treasury contract is exist then change that to treasury.address
  // );
  // await treasury.configure(
  //   process.env.MAINNERT_OWNER_ACCOUNT,
  //   '0x0000000000000000000000000000000000000000', // set OneSplit account here
  //   governance.address,
  //   xbe.address, // Reward token
  // );
}

module.exports = function (deployer, network, accounts) {

  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  const params = {
    bonusCampaign: {
      rewardsDuration: months("23"),
      emission: ether("5000"),
      mintTime: new BN("1620894602"), // 13 may 2021 11:40
    },
    mockTokens: {
      mockedTotalSupplyXBE: ether("2000"),
      mockedTotalSupplyCRV: ether("2000"),
      mockedAmountXBE: ether("100"),
      mockedAmountCRV: ether("100")
    },
    xbeinflation: {
      initialSupply: new BN("5000"),
      initialRate: new BN("274815283").mul(MULTIPLIER).div(YEAR), // new BN('10000').mul(MULTIPLIER).div(YEAR)
      rateReductionTime: YEAR,
      rateReductionCoefficient: new BN("1189207115002721024"), // new BN('10').mul(MULTIPLIER)
      rateDenominator: MULTIPLIER,
      inflationDelay: new BN("86400")
    },
    voting: {
      supportRequiredPct: new BN("5100"),
      minAcceptQuorumPct: new BN("3000"),
      voteTime: new BN("1000000")
    },
  };

  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network === 'development' || network.startsWith('rinkeby')) {
      if (network === "rinkeby_deploy") {
        await deployContracts(deployer, params, owner);
      } else if (network === "rinkeby_tokens") {
        await distributeTokens(params, alice, bob, owner);
      } else if (network === "rinkeby_configure") {
        await configureContracts(params, owner);
      } else if (network === "rinkeby_all_with_save") {
        await deployContracts(deployer, params, owner);
        await distributeTokens(params, alice, bob, owner);
        await configureContracts(params, owner);
      } else if (network === "rinkeby_vaults") {
        await deployVaults();
      } else {
        console.error(`Unsupported network: ${network}`);
      }
    } else if (network === 'mainnet') {
      await deployVaultsToMainnet();
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
}
