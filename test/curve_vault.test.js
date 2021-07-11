const { BN, constants, time } = require('@openzeppelin/test-helpers');
const { assert, expect } = require('chai');
// const contractTruffle = require('@truffle/contract');
// const StableSwapUSDT_ABI = require('../abi/StableSwapUSDT.json');
// OBJECTS CONTRACT
// const StableSwapUSDT = contractTruffle(StableSwapUSDT_ABI);

// var abi = <ABI of contract>;                                // Set contract ABI
// var newContract = web3.eth.contract(abi);                   // Contract object
// var contractInstance = newContract.at(<Contract Address>);  // instance of the contract

// contractInstance.functionName.call();
const { ZERO_ADDRESS } = constants;
const distro = require('../distro.json');

const XBEInflation = artifacts.require('XBEInflation');
const VeXBE = artifacts.require('VeXBE');
const Voting = artifacts.require('Voting');
const HiveStrategy = artifacts.require('HiveStrategy');
const HiveVault = artifacts.require('HiveVault');
// const StakingRewards = artifacts.require('StakingRewards');
const BonusCampaign = artifacts.require('BonusCampaign');
const ReferralProgram = artifacts.require('ReferralProgram');

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
const StableSwapUSDT = artifacts.require('StableSwapMockPool');
const ERC20LP = artifacts.require('ERC20LP');
const BaseRewardPool = artifacts.require('BaseRewardPool');
const Booster = artifacts.require('Booster');
const ERC20CRV = artifacts.require('ERC20CRV');
const CVX = artifacts.require('ConvexToken');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));
const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));
const YEAR = new BN('86400').mul(new BN('365'));
const MULTIPLIER = new BN('10').pow(new BN('18'));
const ONE = new BN('1');
const ZERO = new BN('0');

contract('Curve LP Testing', (accounts) => {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  let mockXBE;
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let hiveStrategy;
  let controller;
  let treasury;
  let hiveVault;
  let referralProgram;
  let registry;
  let stableSwapUSDT;
  let erc20LP;
  let baseRewardPool;
  let booster;
  let crv;
  let cvx;

  const params = {
    bonusCampaign: {
      rewardsDuration: months('23'),
      emission: ether('5000'),
      stopRegisterTime: days('30'),
      startMintTime: new BN('0'),
    },
    mockTokens: {
      mockedTotalSupplyXBE: ether('2000'),
      mockedTotalSupplyCRV: ether('2000'),
      mockedAmountXBE: ether('100'),
      mockedAmountCRV: ether('100'),
    },
    xbeinflation: {
      initialSupply: new BN('5000'),
      initialRate: new BN('274815283').mul(MULTIPLIER).div(YEAR), // new BN('10000').mul(MULTIPLIER).div(YEAR)
      rateReductionTime: YEAR,
      rateReductionCoefficient: new BN('1189207115002721024'), // new BN('10').mul(MULTIPLIER)
      rateDenominator: MULTIPLIER,
      inflationDelay: new BN('86400'),
    },
    voting: {
      supportRequiredPct: new BN('5100'),
      minAcceptQuorumPct: new BN('3000'),
      voteTime: new BN('1000000'),
    },
    treasury: {
      slippageTolerance: new BN('9500'),
      swapDeadline: days('1'),
    },
    dependentsAddresses: { ...distro.rinkeby },
  };

  const deployContracts = async () => {
    const { dependentsAddresses } = params;

    registry = await Registry.new({ from: owner });

    referralProgram = await ReferralProgram.new({ from: owner });

    treasury = await Treasury.new({ from: owner });
    controller = await Controller.new({ from: owner });
    hiveStrategy = await HiveStrategy.new({ from: owner });
    hiveVault = await HiveVault.new({ from: owner });
    mockXBE = await MockToken.new('Mock XBE', 'mXBE', params.mockTokens.mockedTotalSupplyXBE, { from: owner });
    xbeInflation = await XBEInflation.new({ from: owner });
    bonusCampaign = await BonusCampaign.new({ from: owner });
    veXBE = await VeXBE.new({ from: owner });
    voting = await Voting.new({ from: owner });
    stableSwapUSDT = await StableSwapUSDT.at(
      dependentsAddresses.curve.pool_data.mock_pool.swap_address,
    );
    erc20LP = await ERC20LP.at(dependentsAddresses.curve.pool_data.mock_pool.lp_token_address);
    baseRewardPool = await BaseRewardPool.at(dependentsAddresses.convex.pools[0].crvRewards);
    booster = await Booster.at(dependentsAddresses.convex.booster);
    crv = await ERC20CRV.at(dependentsAddresses.curve.CRV);
    cvx = await CVX.at(dependentsAddresses.convex.cvx);
  };

  const configureContracts = async () => {
    const { dependentsAddresses } = params;

    const now = await time.latest();

    await referralProgram.configure(
      [mockXBE.address, dependentsAddresses.convex.cvx, dependentsAddresses.convex.cvxCrv],
      treasury.address,
    );

    await registry.configure(
      owner,
    );

    await treasury.configure(
      voting.address,
      voting.address,
      mockXBE.address,
      dependentsAddresses.uniswap_router_02,
      dependentsAddresses.uniswap_factory,
      params.treasury.slippageTolerance,
      now.add(params.treasury.swapDeadline),
    );

    await controller.configure(
      treasury.address,
      owner,
      owner,
    );

    await controller.setVault(
      dependentsAddresses.convex.pools[0].lptoken,
      hiveVault.address,
    );

    await controller.setApprovedStrategy(
      dependentsAddresses.convex.pools[0].lptoken,
      hiveStrategy.address,
      true,
    );

    await controller.setStrategy(
      dependentsAddresses.convex.pools[0].lptoken,
      hiveStrategy.address,
    );

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
    );

    await hiveVault.configure(
      dependentsAddresses.curve.pool_data.mock_pool.lp_token_address,
      controller.address,
      owner,
      referralProgram.address,
      treasury.address,
    );

    await hiveVault.addTokenRewards(
      dependentsAddresses.curve.CRV,
    );
    await hiveVault.addTokenRewards(
      dependentsAddresses.convex.cvx,
    );
    await hiveVault.addTokenRewards(
      mockXBE.address,
    );
    await xbeInflation.configure(
      mockXBE.address,
      params.xbeinflation.initialSupply,
      params.xbeinflation.initialRate,
      params.xbeinflation.rateReductionTime,
      params.xbeinflation.rateReductionCoefficient,
      params.xbeinflation.rateDenominator,
      params.xbeinflation.inflationDelay,
    );
    await xbeInflation.addXBEReceiver(
      hiveStrategy.address,
      100000,
    );
    await bonusCampaign.configure(
      mockXBE.address,
      veXBE.address,
      now.add(params.bonusCampaign.startMintTime),
      now.add(params.bonusCampaign.stopRegisterTime),
      params.bonusCampaign.rewardsDuration,
      params.bonusCampaign.emission,
    );

    await veXBE.configure(
      mockXBE.address,
      'VotingXBE',
      'veXBE',
      '0.0.1',
    );

    await voting.initialize(
      veXBE.address,
      params.voting.supportRequiredPct,
      params.voting.minAcceptQuorumPct,
      params.voting.voteTime,
      { from: owner },
    );
  };

  async function initialization() {
    await deployContracts();
    await configureContracts();
  }

  before(initialization);
  describe('Purchase of Tokens', async () => {
    const { dependentsAddresses } = params;
    it('getting vault lp', async () => {
      const depositAlice = ether('3');
      const depositBob = ether('10');
      // deposit Alice
      // eslint-disable-next-line no-underscore-dangle
      await stableSwapUSDT._mint_for_testing(depositAlice, { from: alice });
      await erc20LP.approve(hiveVault.address, depositAlice, { from: alice });
      await hiveVault.deposit(depositAlice, { from: alice });
      const lpAlice = await hiveVault.balanceOf(alice);
      expect(lpAlice).to.be.bignumber.equal(depositAlice);

      // backend call earn func
      await hiveVault.earn();
      const balanceReward = await baseRewardPool.balanceOf(hiveStrategy.address);
      expect(balanceReward).to.be.bignumber.equal(depositAlice);

      // someone will call this function for our pool in Booster contract
      await booster.earmarkRewards('0');
      // time passes
      await time.increase(months('2'));

      // alice's earnings
      const earnedRealAlice = await hiveVault.earnedReal.call({ from: alice });
      const earnedVirtualAlice = await hiveVault.earnedVirtual.call({ from: alice });

      // should be equal zero
      expect(earnedRealAlice[0].toString()).to.be.equal('0');
      // should be greater than zero
      expect(earnedVirtualAlice[0].toString()).to.be.bignumber.above(new BN('0'));

      // deposit Bob
      // eslint-disable-next-line no-underscore-dangle
      await stableSwapUSDT._mint_for_testing(depositBob, { from: bob });
      await erc20LP.approve(hiveVault.address, depositBob, { from: bob });

      await hiveVault.deposit(depositBob, { from: bob });
      const lpBob = await hiveVault.balanceOf(bob);
      const total = await hiveVault.totalSupply();

      // deposit * totalSupply() / balance()
      expect(lpBob).to.be.bignumber.equal(ether('3'));
      // alice + bob LP
      expect(total).to.be.bignumber.equal(ether('6'));
      // backend call earn func
      await hiveVault.earn();
      // someone will call this function for our pool in Booster contract
      await booster.earmarkRewards('0');
      // time passes
      await time.increase(months('1'));
      // someone will call this function for our pool in Booster contract
      await booster.earmarkRewards('0');

      const balanceRewardAfterBob = await baseRewardPool.balanceOf(hiveStrategy.address);
      // deposit Alice + depoist Bob
      expect(balanceRewardAfterBob).to.be.bignumber.equal(depositAlice.add(depositBob));

      const earnedVirtualBob = await hiveVault.earnedVirtual.call({ from: bob });
      const canClaimStrategy = await hiveStrategy.canClaim.call();
      // console.log(earnedVirtualBob.toString());
      // console.log(canClaimStrategy.toString());

      // claim real for alice

      // backend called getRewards for specified strategy
      await controller.getRewardStrategy(hiveStrategy.address);

      // const balanceAtContract = await hiveStrategy.earned.call();
      const earnedReal = await hiveVault.earnedReal.call({ from: alice });
      const { logs } = await hiveVault.claim({ from: alice });

      const afterCRV = await crv.balanceOf.call(alice);
      const afterXBE = await mockXBE.balanceOf.call(alice);
      const afterCVX = await cvx.balanceOf.call(alice);
      console.log(afterCRV.toString());
      // console.log(earnedReal.toString());
      console.log(afterXBE.toString());
      console.log(afterCVX.toString());

      // claim virtual bob

      // deposit with protocol fee
    });
  });
});
