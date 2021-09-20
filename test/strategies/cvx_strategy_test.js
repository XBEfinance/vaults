const { expect, assert } = require('chai');
const {
  BN,
  // constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');

const common = require('../utils/common');
const constants = require('../utils/constants');
const deployment = require('../utils/deployment');
const environment = require('../utils/environment');
const { people, setPeople } = require('../utils/accounts');
const distro = require('../../../curve-convex/distro.json');
const artifacts = require('../utils/artifacts');

const { ZERO, ZERO_ADDRESS } = constants.utils;
const { days, months } = constants.time;

const {
  HiveStrategy,
  CVXStrategy,
  HiveVault,
  CVXVault,
  ReferralProgram,
  StableSwapMockPool,
  StableSwapUSDT,
  ERC20LP,
  BaseRewardPool,
  Booster,
  ERC20CRV,
  ConvexToken,
  IERC20,
} = require('../utils/artifacts');
const { waitFor } = require("../utils/common");
const utilsConstants = require("../utils/constants.js");

contract('cvx strategy & vault testing', (accounts) => {
  setPeople(accounts);

  let mockXBE;
  let simpleXBEInflation;
  let bonusCampaign;
  let veXBE;
  let votingStakingRewards;
  let hiveStrategy;
  let controller;
  let treasury;
  let hiveVault;
  let cvxStrategy;
  let cvxVault;
  let referralProgram;
  let registry;
  let stableSwapUSDT;
  let crvRewardsPool;
  let booster;
  let crv;
  let cvx;
  let cvxCrv;
  let LPTokenMockPool;
  let stableSwapMockPool;
  let mock;
  let owner;
  let alice;
  let bob;
  let wallet;

  function logValues (msg, v1, v2, v3, v4) {
    console.log(`${msg}:\tcrv: ${v1},\tcvx: ${v2},\txbe: ${v3},\tcvxCRV:${v4}`);
  }
  async function logEarnings(vault, addr, msg)  {
    const crvEarned = await vault.earned(distro.rinkeby.curve.CRV, addr);
    const cvxEarned = await vault.earned(distro.rinkeby.convex.cvx, addr);
    const xbeEarned = await vault.earned(mockXBE.address, addr);
    const v4 = await vault.isValidToken(cvxCrv.address) ? await vault.earned(cvxCrv.address, addr): '0';
    logValues(msg, crvEarned, cvxEarned, xbeEarned, v4.toString());
  }
  async function logRewards (vault, addr, msg) {
    const crvReward = await vault.rewards(addr, distro.rinkeby.curve.CRV);
    const cvxReward = await vault.rewards(addr, distro.rinkeby.convex.cvx);
    const xbeReward = await vault.rewards(addr, mockXBE.address);
    const v4 = await vault.isValidToken(cvxCrv.address)
      ? await vault.rewards(cvxCrv.address, addr): '0';
    logValues(msg, crvReward, cvxReward, xbeReward, v4);
  }
  async function logBalance (addr, msg = '') {
    const crvBalance = await crv.balanceOf(addr);
    const xbeBalance = await mockXBE.balanceOf(addr);
    const cvxBalance = await cvx.balanceOf(addr);
    const v4 = await cvxCrv.balanceOf(addr);
    logValues(msg, crvBalance, cvxBalance, xbeBalance, v4);
  }
  async function logRpts (vault, msg = '') {
    const v1 = await vault.rewardsPerTokensStored(crv.address);
    const v2 = await vault.rewardsPerTokensStored(cvx.address);
    const v3 = await vault.rewardsPerTokensStored(mockXBE.address);
    const v4 = await vault.isValidToken(cvxCrv.address) ? await vault.rewardsPerTokensStored(cvxCrv.addr): '0';
    logValues(msg, v1, v2, v3, v4);
  }
  async function logRpt(vault, msg = '') {
    const v1 = await vault.rewardPerToken(crv.address);
    const v2 = await vault.rewardPerToken(cvx.address);
    const v3 = await vault.rewardPerToken(mockXBE.address);
    const v4 = await vault.isValidToken(cvxCrv.address) ? await vault.rewardPerToken(cvxCrv.address) : '0';
    logValues(msg, v1, v2, v3, v4.toString());
  }
  async function logUrptp(vault, addr, msg = '') {
    const v1 = await vault.userRewardPerTokenPaid(crv.address, addr);
    const v2 = await vault.userRewardPerTokenPaid(cvx.address, addr);
    const v3 = await vault.userRewardPerTokenPaid(mockXBE.address, addr);
    const v4 = await vault.isValidToken(cvxCrv.address) ?
      await vault.userRewardPerTokenPaid(cvxCrv.address, addr) : '0';

    logValues(msg, v1, v2, v3, v4);
  }
  async function logAllRewards (vault, msg) {
    console.log('\n', msg);
    await logBalance(alice, 'balances');
    await logEarnings(vault, alice, 'earned');
    await logRewards(vault, alice, 'rewards');
    await logRpts(vault, 'reward pts');
    await logUrptp(vault, alice, 'userrptp');
    await logRpt(vault, 'rewards pt');
    await logBalance(hiveVault.address, 'hive balances');
  }

  async function mintTokens(user) {
    const depositAlice = ether('3');

    // deposit Alice
    // eslint-disable-next-line no-underscore-dangle
    await stableSwapMockPool._mint_for_testing(depositAlice, { from: user });
    await logAllRewards(hiveVault, 'point 1');
    await LPTokenMockPool.approve(hiveVault.address, depositAlice, { from: user });
    await hiveVault.deposit(depositAlice, { from: user });
    await hiveVault.earn({ from: owner });
    await time.increase(months('1'));
    await booster.earmarkRewards(ZERO, { from: owner });
    await controller.getRewardStrategy(LPTokenMockPool.address, { from: owner });
    await logAllRewards(hiveVault, 'point 1');
    await time.increase(months('1'));
    await hiveVault.getReward(true, {from: user});
    await logAllRewards(hiveVault,'point 2');
    await hiveVault.getReward(true, {from: user});
    await logAllRewards(hiveVault, 'point 3');
  }

  async function deployAndConfigure() {
    owner = people.owner;
    alice = people.alice;
    bob = people.bob;
    wallet = people.tod;

    hiveVault = await HiveVault.new();
    hiveStrategy = await HiveStrategy.new();
    cvxVault = await CVXVault.new();
    cvxStrategy = await CVXStrategy.new();
    referralProgram = await ReferralProgram.new();
    stableSwapMockPool = await StableSwapMockPool
      .at(distro.rinkeby.curve.pool_data.mock_pool.swap_address);
    LPTokenMockPool = await ERC20LP.at(distro.rinkeby.convex.pools[0].lptoken);
    crvRewardsPool = await BaseRewardPool.at(distro.rinkeby.convex.pools[0].crvRewards);
    booster = await Booster.at(distro.rinkeby.convex.booster);
    cvx = await ConvexToken.at(distro.rinkeby.convex.cvx);
    crv = await ERC20CRV.at(distro.rinkeby.curve.CRV);
    cvxCrv = await IERC20.at(distro.rinkeby.convex.cvxCrv);
    mock = await deployment.MockContract();
    votingStakingRewards = await deployment.MockContract();

    console.log('hive', hiveVault.address);

    [
      mockXBE,
      treasury,
      controller,
      simpleXBEInflation,
      registry,
    ] = await environment.getGroup([
        'MockXBE',
        'Treasury',
        'Controller',
        'SimpleXBEInflation',
        'Registry',
      ],
      (key) => [
        'MockXBE',
        'Treasury',
        'Controller',
        'SimpleXBEInflation',
        'Registry',
      ].includes(key),
      true,
      {
        "VotingStakingRewards": {
          4: ZERO_ADDRESS,
          5: ZERO_ADDRESS,
          8: [hiveVault.address],
        },
        "Treasury": {
          1: votingStakingRewards.address,
          3: mock.address,
        },
      });

    console.log('configure referral program');

    await referralProgram.configure(
      [
        distro.rinkeby.curve.CRV,
        distro.rinkeby.convex.cvx,
        mockXBE.address,
      ],
      treasury.address,
      registry.address,
    );

    console.log('referral program configured');
    console.log('controller set vault');

    await controller.setVault(
      LPTokenMockPool.address,
      hiveVault.address,
      { from: owner },
    );

    console.log('controller approve strategy');
    await controller.setApprovedStrategy(
      LPTokenMockPool.address,
      hiveStrategy.address,
      true,
      { from: owner },
    );

    console.log('controller set strategy');
    await controller.setStrategy(
      LPTokenMockPool.address,
      hiveStrategy.address,
      { from: owner },
    );

    console.log('configure hive strategy');
    await hiveStrategy.configure(
      LPTokenMockPool.address,
      controller.address,
      owner,
      [
        crvRewardsPool.address,
        distro.rinkeby.convex.cvxRewards,
        booster.address,
        distro.rinkeby.convex.pools[0].id,
        distro.rinkeby.curve.CRV,
        distro.rinkeby.convex.cvx,
      ],
      { from: owner },
    );

    console.log('configure hive vault');
    await hiveVault.configure(
      LPTokenMockPool.address, // _initialToken
      controller.address, // _initialController
      owner, // _governance
      constants.localParams.vaults.rewardsDuration, // _rewardsDuration
      mockXBE.address, // _tokenToAutostake
      votingStakingRewards.address, // _votingStakingRewards
      false, // _enableFees
      wallet, // _teamWallet
      referralProgram.address, // _referralProgram
      treasury.address, // _treasury
      [ // _rewardsTokens
        distro.rinkeby.curve.CRV,
        distro.rinkeby.convex.cvx,
        mockXBE.address,
      ],
      'Hive Vault', // __namePostfix
      'hv', // __symbolPostfix
      { from: owner },
    );

    console.log('set reward distribution');
    await hiveVault.setRewardsDistribution(
      hiveStrategy.address,
      { from: owner },
    );

    console.log('registry add vault');
    await registry.addVault(hiveVault.address, { from: owner },);

    console.log('hive configured');

    console.log('configure cvx strategy&vault');
    console.log('controller set vault');

    await controller.setVault(
      cvx.address,
      cvxVault.address,
      { from: owner },
    );

    console.log('controller approve strategy');
    await controller.setApprovedStrategy(
      cvx.address,
      cvxStrategy.address,
      true,
      { from: owner },
    );

    console.log('controller set strategy');
    await controller.setStrategy(
      cvx.address,
      cvxStrategy.address,
      { from: owner },
    );

    console.log('configure hive strategy');
    await cvxStrategy.configure(
      cvx.address,
      controller.address,
      owner,
      [
        distro.rinkeby.convex.cvxRewards,
        ZERO, // remove it
      ],
      { from: owner },
    );

    console.log('configure hive vault');
    await cvxVault.configure(
      cvx.address,
      controller.address, // _initialController
      owner, // _governance
      constants.localParams.vaults.rewardsDuration, // _rewardsDuration
      mockXBE.address, // _tokenToAutostake
      votingStakingRewards.address, // _votingStakingRewards
      true, // _enableFees
      wallet, // _teamWallet
      referralProgram.address, // _referralProgram
      treasury.address, // _treasury
      [ // _rewardsTokens
        distro.rinkeby.convex.cvxCrv,
        mockXBE.address,
      ],
      'XC', // _namePostfix
      'XC', // _symbolPostfix
      { from: owner },
    );

    console.log('set reward distribution');
    await cvxVault.setRewardsDistribution(
      cvxStrategy.address,
      { from: owner },
    );

    console.log('registry add vault');
    await registry.addVault(cvxVault.address, { from: owner },);

    console.log('cvx configured');

    console.log('set xbe receivers');
    await simpleXBEInflation.setXBEReceiver(
      hiveStrategy.address,
      new BN('2500'),
    );

    await simpleXBEInflation.setXBEReceiver(
      treasury.address,
      new BN('2500'),
    );

    await simpleXBEInflation.setXBEReceiver(
      cvxStrategy.address,
      new BN('2500'),
    );

    console.log('mint inflation');
    await simpleXBEInflation.mintForContracts();

    console.log('inflation minted');

    const {
      crvRewards, cvxRewards, convexBooster,
      poolIndex, crvToken, cvxToken
    } = await hiveStrategy.poolSettings();

    console.log('pool settings');
    console.log('crvRewarder:', crvRewards);
    console.log('cvxRewarder:', cvxRewards);
    console.log('convex booster:', convexBooster);
    console.log('pool index:', poolIndex.toString());
    console.log('crv:', crvToken);
    console.log('cvx:', cvxToken);

    console.log('configuration completed');
  }

  describe('cvx strategy & vault tests', async () => {
    beforeEach(deployAndConfigure);

    xit('properly configured', async () => {
      let vault = hiveVault;
      expect(await vault.owner()).to.be.equal(owner);
      expect(await vault.stakingToken()).to.be.equal(LPTokenMockPool.address);
      expect(await vault.controller()).to.be.equal(controller.address);
      expect(await vault.rewardsDuration()).to.be.bignumber.equal(
        utilsConstants.localParams.vaults.rewardsDuration
      );

      expect(
        await hiveVault.getRewardTokensCount()
      ).to.be.bignumber.equal(new BN('3'));
      expect(await vault.isTokenValid(mockXBE.address)).to.be.true;
      expect(await vault.isTokenValid(crv.address)).to.be.true;
      expect(await vault.isTokenValid(cvx.address)).to.be.true;
      expect(await vault.isTokenValid(mock.address)).to.be.false;

      vault = cvxVault;
      expect(await vault.owner()).to.be.equal(owner);
      expect(await vault.stakingToken()).to.be.equal(cvx.address);
      expect(await vault.controller()).to.be.equal(controller.address);
      expect(await vault.rewardsDuration()).to.be.bignumber.equal(
        utilsConstants.localParams.vaults.rewardsDuration
      );

      expect(
        await vault.getRewardTokensCount()
      ).to.be.bignumber.equal(new BN('2'));
      expect(await vault.isTokenValid(mockXBE.address)).to.be.true;
      expect(await vault.isTokenValid(crv.address)).to.be.false;
      expect(await vault.isTokenValid(distro.rinkeby.convex.cvxCrv)).to.be.true;
      expect(await vault.isTokenValid(mock.address)).to.be.false;
    });

    xit('should mint tokens for testing', async () => {
      await mintTokens(alice);

      expect(await cvx.balanceOf(alice)).to.be.bignumber.gt(ZERO);
      expect(await crv.balanceOf(alice)).to.be.bignumber.gt(ZERO);
    });

    // const { dependentsAddresses } = params;
    it('acceptance test', async () => {
      expect(await cvxVault.feesEnabled()).to.be.true;

      await mintTokens(alice);

      const depositAlice = await cvx.balanceOf(alice);
      console.log('alice cvx balance', depositAlice.toString());
      expect(depositAlice).to.be.bignumber.gt(ZERO);

      await cvx.approve(cvxVault.address, depositAlice, { from: alice });
      await cvxVault.deposit(depositAlice, { from: alice });

      // balance is what we staked
      const lpAlice = await cvxVault.balanceOf(alice);
      expect(lpAlice).to.be.bignumber.equal(depositAlice);

      // backend call earn func
      await cvxVault.earn();
      await time.increase(months('1'));
      await controller.getRewardStrategy(cvx.address, { from: owner });
      await time.increase(months('1'));
      await controller.getRewardStrategy(cvx.address, { from: owner });
      await cvxVault.getReward({from: alice});
      await logAllRewards(cvxVault.address, 'hhh');
      console.log('alice reward in cvxCRV', await cvxCrv.balanceOf(alice));
      await cvxVault.withdraw(depositAlice, { from: alice });

    });
  });
});
