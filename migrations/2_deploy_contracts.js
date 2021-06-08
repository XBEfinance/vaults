const Treasury = artifacts.require('Treasury');
const Governance = artifacts.require('Governance');
const XBE = artifacts.require('XBE');
const TokenWrapper = artifacts.require("TokenWrapper");

//
// const Router = artifacts.require('Router');
// const StakingManager = artifacts.require('StakingManager');
//
// const Multisig = artifacts.require('MultiSignature');
// const AllowList = artifacts.require('AllowList');
// const SecurityAssetToken = artifacts.require('SecurityAssetToken');
// const BondTokenMock = artifacts.require('BondTokenMock');
// const BondToken = artifacts.require('BondToken');
// const TokenAccessRoles = artifacts.require('TokenAccessRoles');
// const DDP = artifacts.require('DDP');
//
// // const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
// // const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// // const BUSD = "0x4Fabb145d64652a948d72533023f6E7A623C7C53";
// // const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
//
// const baseURI = 'https://google.com/';
// const zeroAddress = '0x0000000000000000000000000000000000000000';
//
// const usd = (n) => web3.utils.toWei(n, 'Mwei');

const { BN } = require('@openzeppelin/test-helpers');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const ONE = new BN('1');
const ZERO = new BN('0');
//
module.exports = function (deployer, network, accounts) {
  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network === "rinkeby_safe_test") {
      const TestExecutor = artifacts.require("TestExecutor");
      const MockContract = artifacts.require("MockContract");
      const MockToken = artifacts.require("MockToken");
      const IGnosisSafe = artifacts.require("IGnosisSafe");

      const firstOwner = accounts[0];
      const alice = accounts[3];

      const aliceAmount = ether('0.01');

      const proposalHash = "some proposal hash";
      const minumumForVoting = ether('0.01');
      const quorumForVoting = ONE;
      const periodForVoting = new BN('2');
      const lockForVoting = new BN('2');

      const safe = await IGnosisSafe.at("0xD78D94634d8F2E3eFADE97A5D13Da04c92440e67");
      const mock = await deployer.deploy(MockContract);
      const mockToken = await deployer.deploy(MockToken, "Some Token", "ST", web3.utils.toWei('50', 'ether'));
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
      const Bank = artifacts.require("Bank");
      const BankProxyAdmin = artifacts.require("BankProxyAdmin");
      const BankTransparentProxy = artifacts.require("BankTransparentProxy");
      const MockToken = artifacts.require("MockToken");
      const eurxb = await MockToken.at('0x49Fdb5C0DC55195b5f7AC731e5f5d389925C8c03');
      const treasury = await Treasury.at('0x8D77234fC07167380fE0b776342B9bB4f46cE4a4');
      const bank = await deployer.deploy(Bank);
      const configureCalldata = bank.contract.methods.configure(eurxb.address).encodeABI();
      const bankProxyAdmin = await deployer.deploy(BankProxyAdmin, treasury.address);
      await deployer.deploy(BankTransparentProxy, bank.address, bankProxyAdmin.address, configureCalldata);

      // if (process.env.RINKEBY_OWNER_ACCOUNT && process.env.REWARD_DISTRIBUTION_RINKEBY_ACCOUNT) {
      //   const xbe = await XBE.at('0xfaC2D38F064A35b5C0636a7eDB4B6Cc13bD8D278');
      //   const governance = await deployer.deploy(Governance);
      //   await governance.configure(
      //     '0',
      //     xbe.address, // Reward token
      //     process.env.RINKEBY_OWNER_ACCOUNT,
      //     xbe.address, // Governance token
      //     process.env.REWARD_DISTRIBUTION_RINKEBY_ACCOUNT,
      //   );
      //
      //   const treasury = await deployer.deploy(Treasury);
      //   await treasury.configure(
      //     process.env.RINKEBY_OWNER_ACCOUNT,
      //     '0x0000000000000000000000000000000000000000', // testnet OneSplit account
      //     governance.address,
      //     xbe.address, // Reward token
      //   );
      // }
    }
  });
}
//   deployer.then(async () => {
//     if (network === 'test' || network === 'soliditycoverage') {
//       await deployer.deploy(LinkedList);
//       await deployer.link(LinkedList, MockLinkedList);
//       await deployer.link(LinkedList, EURxb);
//
//       await deployer.deploy(TokenAccessRoles);
//       await deployer.link(TokenAccessRoles, BondTokenMock);
//       await deployer.link(TokenAccessRoles, BondToken);
//       await deployer.link(TokenAccessRoles, SecurityAssetToken);
//       await deployer.link(TokenAccessRoles, DDP);
//       await deployer.link(TokenAccessRoles, EURxb);
//     } else if (network.startsWith('rinkeby')) {
//       // FIRST PART OF DEPLOYING
//       if (network === 'rinkeby_part_one') {
//           const owner = process.env.DEPLOYER_ACCOUNT;
//           await deployer.deploy(LinkedList, { overwrite: false });
//           await deployer.link(LinkedList, EURxb);
//
//           await deployer.deploy(TokenAccessRoles, { overwrite: false });
//           await deployer.link(TokenAccessRoles, BondToken);
//           await deployer.link(TokenAccessRoles, SecurityAssetToken);
//           await deployer.link(TokenAccessRoles, DDP);
//           await deployer.link(TokenAccessRoles, EURxb);
//
//           const multisig = await deployer.deploy(
//             Multisig, [process.env.DEPLOYER_ACCOUNT], 1,
//           );
//           const allowList = await deployer.deploy(AllowList, multisig.address);
//           const bond = await deployer.deploy(BondToken, baseURI);
//           const sat = await deployer.deploy(
//             SecurityAssetToken, baseURI, multisig.address, bond.address, allowList.address,
//           );
//           const ddp = await deployer.deploy(DDP, multisig.address);
//           const eurxb = await deployer.deploy(EURxb, multisig.address);
//
//           await eurxb.configure(ddp.address);
//
//           await bond.configure(
//             allowList.address,
//             sat.address,
//             ddp.address,
//           );
//
//           await multisig.configure(
//             allowList.address,
//             ddp.address,
//             sat.address,
//           );
//
//           await ddp.configure(
//             bond.address,
//             eurxb.address,
//             allowList.address,
//           );
//
//           await multisig.allowAccount(process.env.DEPLOYER_ACCOUNT);
//
//           // create 2 tokens
//           await multisig.mintSecurityAssetToken(process.env.TEAM_ACCOUNT, ether('200000'),
//             365 * 86400 + process.env.START_TIME);
//           await multisig.mintSecurityAssetToken(process.env.TEAM_ACCOUNT, ether('200000'),
//             365 * 86400 + process.env.START_TIME);
//
//           // deploy and configure USDT
//           const usdt = await deployer.deploy(TetherToken, usd('1000000'), 'Tether USD', 'USDT', 6);
//
//           // deploy and configure BUSD
//           const busd = await deployer.deploy(BUSDImplementation);
//           await busd.unpause();
//           await busd.increaseSupply(ether('1000000'));
//
//           // deploy and configure USDC
//           const usdc = await deployer.deploy(FiatTokenV2);
//           await usdc.initialize('USD Coin', 'USDC', 'USD', 6, owner, owner, owner, owner);
//           await usdc.configureMinter(owner, usd('1000000'));
//           await usdc.mint(owner, usd('1000000'));
//
//           // deploy and configure DAI
//           const dai = await deployer.deploy(Dai, 1);
//           await dai.mint(owner, ether('1000000'));
//       } else if (network === 'rinkeby_part_two') {
//           // SECOND PART OF DEPLOYING
//           // CHANGE ADDRESSES AFTER FIRST PART OF DEPLOYING
//           const eurxb = await EURxb.deployed();
//           // get stable coins contracts
//           const usdt = await TetherToken.deployed();
//           const usdc = await FiatTokenV2.deployed();
//           const busd = await BUSDImplementation.deployed();
//           const dai = await Dai.deployed();
//
//           const xbg = await deployer.deploy(XBG, ether('15000'));
//
//           // deploy governance token
//           const governance = await deployer.deploy(Governance);
//           // configure gov contract
//           await governance.configure(
//               0,
//               zeroAddress,
//               process.env.DEPLOYER_ACCOUNT,
//               xbg.address
//           );
//
//           // Deploy Vaults, Registry, Controller and CloneFactory
//           const institutionalEURxbVault = await deployer.deploy(InstitutionalEURxbVault);
//           const consumerEURxbVault = await deployer.deploy(ConsumerEURxbVault);
//
//           const eurxbStrategy = await deployer.deploy(EURxbStrategy);
//
//           const controller = await deployer.deploy(Controller);
//           await controller.configure(
//             zeroAddress,
//             zeroAddress
//           );
//           const registry = await deployer.deploy(Registry);
//
//           await deployer.deploy(Clones);
//           await deployer.link(Clones, CloneFactory);
//           const cloneFactory = await deployer.deploy(CloneFactory);
//
//           // Deploy clones for EURxb and EURxbStrategy
//           const strategyCloneSalt = web3.utils.utf8ToHex('strategy clone');
//           const eurxbStrategyCloneAddress = await cloneFactory.predictCloneAddress(
//             eurxbStrategy.address,
//             strategyCloneSalt
//           );
//           await cloneFactory.clone(
//             eurxbStrategy.address,
//             strategyCloneSalt
//           );
//           const eurxbStrategyClone = await EURxbStrategy.at(
//             eurxbStrategyCloneAddress
//           );
//
//           const eurxbCloneSalt = web3.utils.utf8ToHex('eurxb clone');
//           const eurxbCloneAddress = await cloneFactory.predictCloneAddress(
//             eurxb.address,
//             eurxbCloneSalt
//           );
//           await cloneFactory.clone(
//             eurxb.address,
//             eurxbCloneSalt
//           )
//           const eurxbClone = await EURxb.at(
//             eurxbCloneAddress
//           );
//
//           // Configure that customer vault has clones of eurxb and strategy
//           // Configure that institutional vault has original eurxb and strategy
//           await eurxbStrategy.configure(
//             eurxb.address,
//             controller.address,
//             institutionalEURxbVault.address
//           );
//
//           await eurxbStrategyClone.configure(
//             eurxbClone.address,
//             controller.address,
//             consumerEURxbVault.address
//           );
//
//           await institutionalEURxbVault.configure(
//             eurxb.address,
//             controller.address
//           );
//
//           await consumerEURxbVault.configure(
//             eurxbClone.address,
//             controller.address
//           );
//
//           // Adding vaults and strategies to Controller
//           await controller.setVault(
//             eurxb.address,
//             institutionalEURxbVault.address
//           );
//
//           await controller.setVault(
//             eurxbClone.address,
//             consumerEURxbVault.address
//           );
//
//           await controller.setApprovedStrategy(
//             eurxb.address,
//             eurxbStrategy.address,
//             true
//           );
//
//           await controller.setApprovedStrategy(
//             eurxbClone.address,
//             eurxbStrategyClone.address,
//             true
//           );
//
//           await controller.setStrategy(
//             eurxb.address,
//             eurxbStrategy.address
//           );
//
//           await controller.setStrategy(
//             eurxbClone.address,
//             eurxbStrategyClone.address
//           );
//
//           // Adding vaults to Registry
//           await registry.addVault(institutionalEURxbVault.address);
//           await registry.addVault(consumerEURxbVault.address);
//
//           // deploy Router and StakingManager contracts
//           const sm = await deployer.deploy(
//             StakingManager, xbg.address, process.env.START_TIME,
//           );
//
//           const router = await deployer.deploy(Router, process.env.TEAM_ACCOUNT);
//
//           // configure uniswap pools
//           const uniswapRouter = await UniswapV2Router02.at('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
//           const uniswapFactory = await UniswapV2Factory.at('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f');
//
//           let usdtPoolAddress = await uniswapFactory.getPair.call(eurxb.address, usdt.address);
//           let busdPoolAddress = await uniswapFactory.getPair.call(eurxb.address, busd.address);
//
//           if (usdtPoolAddress === '0x0000000000000000000000000000000000000000') {
//             await uniswapFactory.createPair(eurxb.address, usdt.address);
//             usdtPoolAddress = await uniswapFactory.getPair.call(eurxb.address, usdt.address);
//             console.log('usdtPoolAddress after deploy', usdtPoolAddress);
//           } else {
//             console.log('usdtPoolAddress address:', usdtPoolAddress);
//           }
//           const usdtPool = await UniswapV2Pair.at(usdtPoolAddress);
//
//           if (busdPoolAddress === '0x0000000000000000000000000000000000000000') {
//             await uniswapFactory.createPair(eurxb.address, busd.address);
//             busdPoolAddress = await uniswapFactory.getPair.call(eurxb.address, busd.address);
//             console.log('busdPoolAddress after deploy', busdPoolAddress);
//           } else {
//             console.log('busdPoolAddress address:', busdPoolAddress);
//           }
//           const busdPool = await UniswapV2Pair.at(busdPoolAddress);
//
//           // configure balancer pools
//           const bFactory = await BFactory.at('0x4Cab4b9E97458dc121D7a76F94eE067e85c0E833');
//
//           await bFactory.newBPool();
//           const usdcPoolAddress = await bFactory.getLastBPool();
//           const usdcPool = await BPool.at(usdcPoolAddress);
//           await eurxb.approve(usdcPool.address, ether('46'));
//           await usdc.approve(usdcPool.address, usd('54'));
//           await usdcPool.bind(eurxb.address, ether('46'), ether('25'));
//           await usdcPool.bind(usdc.address, usd('54'), ether('25'));
//           await usdcPool.setSwapFee(ether('0.001'));
//           await usdcPool.finalize();
//           console.log('finalize usdcPool at address:', usdcPool.address);
//
//           await bFactory.newBPool();
//           const daiPoolAddress = await bFactory.getLastBPool();
//           const daiPool = await BPool.at(daiPoolAddress);
//           await eurxb.approve(daiPool.address, ether('46'));
//           await dai.approve(daiPool.address, ether('54'));
//           await daiPool.bind(eurxb.address, ether('46'), ether('25'));
//           await daiPool.bind(dai.address, ether('54'), ether('25'));
//           await daiPool.setSwapFee(ether('0.001'));
//           await daiPool.finalize();
//           console.log('finalize daiPool at address:', daiPool.address);
//
//           // configure our contracts
//           await xbg.approve(sm.address, ether('12000'));
//           await sm.configure([
//             usdtPool.address, usdcPool.address, busdPool.address, daiPool.address]);
//           await router.configure(sm.address, uniswapRouter.address,
//             usdt.address, usdc.address, busd.address, dai.address,
//             eurxb.address);
//
//           await eurxb.transfer(router.address, ether('100000'));
//       } else {
//           console.error(`Unsupported rinkeby network: ${network}`);
//       }
//     } else {
//       console.error(`Unsupported network: ${network}`);
//     }
//   });
// };
