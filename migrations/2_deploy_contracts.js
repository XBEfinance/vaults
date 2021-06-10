// const { accounts, contract } = require('@openzeppelin/test-environment');
const Treasury = artifacts.require('Treasury');
const Governance = artifacts.require('Governance');
const XBE = artifacts.require('XBE');
const TokenWrapper = artifacts.require('TokenWrapper');
const MockToken = artifacts.require('MockToken');
const Registry = artifacts.require('Registry');
const Controller = artifacts.require('Controller');
const ConsumerEURxbVault = artifacts.require('ConsumerEURxbVault');
const InstitutionalEURxbVault = artifacts.require('InstitutionalEURxbVault');
const UnwrappedToWrappedTokenConverter = artifacts.require('UnwrappedToWrappedTokenConverter');
const WrappedToUnwrappedTokenConverter = artifacts.require('WrappedToUnwrappedTokenConverter');
const InstitutionalEURxbStrategy = artifacts.require('InstitutionalEURxbStrategy');
const ConsumerEURxbStrategy = artifacts.require('ConsumerEURxbStrategy');

const { BN } = require('@openzeppelin/test-helpers');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const ONE = new BN('1');
const ZERO = new BN('0');
//
module.exports = function (deployer, network, accounts) {
  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network === 'rinkeby_safe_test') {
      const TestExecutor = contract.fromArtifact('TestExecutor');
      const MockContract = contract.fromArtifact('MockContract');
      const MockToken = contract.fromArtifact('MockToken');
      const IGnosisSafe = contract.fromArtifact('IGnosisSafe');

      const firstOwner = accounts[0];
      const alice = accounts[3];

      const aliceAmount = ether('0.01');

      const proposalHash = 'some proposal hash';
      const minumumForVoting = ether('0.01');
      const quorumForVoting = ONE;
      const periodForVoting = new BN('2');
      const lockForVoting = new BN('2');

      const safe = await IGnosisSafe.attach('0xD78D94634d8F2E3eFADE97A5D13Da04c92440e67');
      const mock = await deployer.deploy(MockContract);
      const mockToken = await deployer.deploy(MockToken, 'Some Token', 'ST', web3.utils.toWei('50', 'ether'));
      const governanceContract = await deployer.deploy(Governance);
      const executor = await deployer.deploy(TestExecutor);

      await governanceContract.configure(
        ZERO,
        mockToken.address,
        firstOwner,
        mockToken.address,
        firstOwner
      );

      await executor.configure(
        mockToken.address,
        alice
      );

      await mockToken.approve(safe.address, aliceAmount, {from: firstOwner});
      await mockToken.transfer(safe.address, aliceAmount, {from: firstOwner});

      await governanceContract.setMinimum(minumumForVoting);
      await governanceContract.setPeriod(periodForVoting);
      await governanceContract.setQuorum(quorumForVoting);
      await governanceContract.setLock(lockForVoting);

      const minimumForProposal = minumumForVoting.mul(new BN('2'));
      await mockToken.approve(governanceContract.address, minimumForProposal);
      await governanceContract.stake(minimumForProposal);

      await governanceContract.register();

      const proposalId = await governanceContract.proposalCount();
      await governanceContract.propose(executor.address, proposalHash);
      await governanceContract.voteFor(proposalId);

      await governanceContract.setGovernance(safe.address);

      console.log('Approve ABI bytes');
      console.log('===============================================');
      console.log(mockToken.contract.methods.approve(executor.address, aliceAmount).encodeABI());
      console.log('===============================================');

      console.log('Transfer ABI bytes');
      console.log('===============================================');
      console.log(mockToken.contract.methods.transfer(executor.address, aliceAmount).encodeABI());
      console.log('===============================================');

      console.log('Execute ABI bytes');
      console.log('===============================================');
      console.log(governanceContract.contract.methods.execute(proposalId).encodeABI());
      console.log('===============================================');
    } else if (network.startsWith('rinkeby')) {
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
    } else if (network.startsWith('mainnet')) {
      const xbe = await XBE.at('0x5DE7Cc4BcBCa31c473F6D2F27825Cfb09cc0Bb16');
      const governance = await deployer.deploy(Governance);
      // const treasury = await deployer.deploy(Treasury);

      await governance.configure(
        '0',
        xbe.address, // Reward token
        process.env.MAINNERT_OWNER_ACCOUNT,
        xbe.address, // Governance token
        process.env.MAINNERT_DISTRIBUTION_RINKEBY_ACCOUNT, // if treasury contract is exist then change that to treasury.address
      );
      // await treasury.configure(
      //   process.env.MAINNERT_OWNER_ACCOUNT,
      //   '0x0000000000000000000000000000000000000000', // set OneSplit account here
      //   governance.address,
      //   xbe.address, // Reward token
      // );
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
