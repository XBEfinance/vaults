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
  HiveVault,
  // CVXStrategy,
  // CVXVault,
  CvxCrvStrategy,
  CvxCrvVault,
  ReferralProgram,
  StableSwapMockPool,
  StableSwapUSDT,
  ERC20LP,
  BaseRewardPool,
  cvxRewardPool,
  Booster,
  ERC20CRV,
  ConvexToken,
  IERC20,
} = require('../utils/artifacts');

const { waitFor } = require("../utils/common");
const utilsConstants = require("../utils/constants.js");

const {
  logValues,
  wrapReward,
  wrapEarned,
  wrapRpts,
  wrapRpt,
  wrapUrptp,
} = require('./util/wrappers');

contract('CVXCRV Strategy & Vault testing', (accounts) => {
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
  let cvxCrvStrategy;
  let cvxCrvVault;
  let referralProgram;
  let registry;
  let stableSwapUSDT;
  let crvRewarder;
  let cvxRewarder
  let cvxCrvRewarder;
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

  async function logEarnings(vault, user, msg)  {
    const crvEarned = await wrapEarned(vault, user, distro.rinkeby.curve.CRV);
    const cvxEarned = await wrapEarned(vault, user, distro.rinkeby.convex.cvx);
    const xbeEarned = await wrapEarned(vault, user, mockXBE.address);
    const cvxCrvEarned = await wrapEarned(vault, user, cvxCrv.address);
    logValues(msg, crvEarned, cvxEarned, xbeEarned, cvxCrvEarned);
  }
  async function logRewards (vault, user, msg) {
    const crvReward = await wrapReward(vault, user, distro.rinkeby.curve.CRV);
    const cvxReward = await wrapReward(vault, user, distro.rinkeby.convex.cvx);
    const xbeReward = await wrapReward(vault, user, mockXBE.address);
    const cvxCrvEarned = await wrapReward(vault, user, cvxCrv.address);
    logValues(msg, crvReward, cvxReward, xbeReward, cvxCrvEarned);
  }
  async function getBalances(user) {
    const v1 = await crv.balanceOf(user);
    const v2 = await mockXBE.balanceOf(user);
    const v3 = await cvx.balanceOf(user);
    const v4 = await cvxCrv.balanceOf(user);
    return { crv: v1, cvx: v3, xbe: v2, cvxcrv: v4};
  }
  async function logBalance (user, msg = '') {
    const balances = await getBalances(user);
    logValues(msg, balances.crv, balances.cvx, balances.xbe, balances.cvxcrv);
  }
  async function logRpts (vault, msg = '') {
    const v1 = await wrapRpts(vault, crv.address);
    const v2 = await wrapRpts(vault, cvx.address);
    const v3 = await wrapRpts(vault, mockXBE.address);
    const v4 = await wrapRpts(vault, cvxCrv.address);
    logValues(msg, v1, v2, v3, v4);
  }
  async function logRpt(vault, msg = '') {
    const v1 = await wrapRpt(vault, crv.address);
    const v2 = await wrapRpt(vault, cvx.address);
    const v3 = await wrapRpt(vault, mockXBE.address);
    const v4 = await wrapRpt(vault, cvxCrv.address);
    logValues(msg, v1, v2, v3, v4.toString());
  }
  async function logUrptp(vault, user, msg = '') {
    const v1 = await wrapUrptp(vault, user, crv.address);
    const v2 = await wrapUrptp(vault, user, cvx.address);
    const v3 = await wrapUrptp(vault, user, mockXBE.address);
    const v4 = await wrapUrptp(vault, user, cvxCrv.address);
    logValues(msg, v1, v2, v3, v4);
  }
  async function logAllRewards (vault, user, msg) {
    console.log('\n', msg);
    await logBalance(user, 'balances');
    await logEarnings(vault, user, 'earned');
    await logRewards(vault, user, 'rewards');
    await logRpts(vault, 'reward pts');
    await logUrptp(vault, user, 'userrptp');
    await logRpt(vault, 'rewards pt');
    await logBalance(hiveVault.address, 'hive balances');
  }

  async function mintTokens(user) {
    const depositAmount = ether('3');
    // eslint-disable-next-line no-underscore-dangle
    await stableSwapMockPool._mint_for_testing(depositAmount, { from: user });
    await LPTokenMockPool.approve(hiveVault.address, depositAmount, { from: user });
    await hiveVault.deposit(depositAmount, { from: user });
    const lpUser = await hiveVault.balanceOf(user);
    expect(lpUser).to.be.bignumber.equal(depositAmount);
    await hiveVault.earn({ from: owner });
    await time.increase(days('7'));
    await booster.earmarkRewards(ZERO, { from: owner });
    await controller.getRewardStrategy(LPTokenMockPool.address, { from: owner });
    await time.increase(days('7'));
    await controller.getRewardStrategy(LPTokenMockPool.address, { from: owner });
    await hiveVault.getReward(true, {from: user});
    await time.increase(days('7'));
    await controller.getRewardStrategy(LPTokenMockPool.address);
    await hiveVault.getReward(true, {from: user});
    await logBalance(user, 'user balances');
    await logBalance(hiveVault.address, 'vault balances');
    await logBalance(hiveStrategy.address, 'strategy balances');

    console.log(' === tokens were minted === ');
    await logBalance(user, 'user balances');
    await logBalance(hiveVault.address, 'vault balances');
    await logBalance(hiveStrategy.address, 'strategy balances');
  }

  async function deployAndConfigure() {
    owner = people.owner;
    alice = people.alice;
    bob = people.bob;
    wallet = people.tod;

    hiveVault = await HiveVault.new('Hive', 'HV');
    hiveStrategy = await HiveStrategy.new();
    cvxCrvVault = await CvxCrvVault.new('CvxCrv', 'CC');
    cvxCrvStrategy = await CvxCrvStrategy.new();
    referralProgram = await ReferralProgram.new();
    stableSwapMockPool = await StableSwapMockPool
      .at(distro.rinkeby.curve.pool_data.mock_pool.swap_address);
    LPTokenMockPool = await ERC20LP.at(distro.rinkeby.convex.pools[0].lptoken);
    crvRewarder = await BaseRewardPool.at(distro.rinkeby.convex.pools[0].crvRewards);
    cvxRewarder = await cvxRewardPool.at(distro.rinkeby.convex.cvxRewards);
    cvxCrvRewarder = await BaseRewardPool.at(distro.rinkeby.convex.cvxCrvRewards);
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
        crvRewarder.address,
        distro.rinkeby.convex.cvxRewards,
        booster.address,
        distro.rinkeby.convex.pools[0].id,
        // distro.rinkeby.curve.CRV,
        // distro.rinkeby.convex.cvx,
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
        mockXBE.address,
        distro.rinkeby.curve.CRV,
        distro.rinkeby.convex.cvx,
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

    console.log('configure cvxCrv strategy&vault');
    console.log('controller set vault');

    await controller.setVault(
      cvxCrv.address,
      cvxCrvVault.address,
      { from: owner },
    );

    console.log('controller approve strategy');
    await controller.setApprovedStrategy(
      cvxCrv.address,
      cvxCrvStrategy.address,
      true,
      { from: owner },
    );

    console.log('controller set strategy');
    await controller.setStrategy(
      cvxCrv.address,
      cvxCrvStrategy.address,
      { from: owner },
    );

    console.log('configure hive strategy');
    await cvxCrvStrategy.configure(
      cvxCrv.address,
      controller.address,
      owner,
      [
        distro.rinkeby.convex.cvxCrvRewards,
        distro.rinkeby.convex.crvDepositor,
        distro.rinkeby.curve.CRV,
      ],
      { from: owner },
    );

    console.log('configure hive vault');
    await cvxCrvVault.configure(
      cvxCrv.address,
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
      'cvxCRV', // _namePostfix
      'CR', // _symbolPostfix
      { from: owner },
    );

    console.log('set reward distribution');
    await cvxCrvVault.setRewardsDistribution(
      cvxCrvStrategy.address,
      { from: owner },
    );

    console.log('registry add vault');
    await registry.addVault(cvxCrvVault.address, { from: owner },);

    console.log('cvxCrv configured');

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
      cvxCrvStrategy.address,
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

  async function cvxPoolEarnedReward(account) {
    const bal = await cvxRewarder.balanceOf(account);
    const rpt = await cvxRewarder.rewardPerToken();
    const urptp = await cvxRewarder.userRewardPerTokenPaid(account);
    const rewards = await cvxRewarder.rewards(account);

    return bal.mul(rpt).sub(urptp).div(new BN('1e18')).add(rewards);
  }

  describe('cvxCrv strategy & vault tests', async () => {
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

      vault = cvxCrvVault;
      expect(await vault.owner()).to.be.equal(owner);
      expect(await vault.stakingToken()).to.be.equal(cvxCrv.address);
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
    xit('convert CRV tokens into cvxCRV', async () => {
      expect(await cvxCrvVault.claimFeesEnabled()).to.be.true;

      // mint cvx, crv tokens to alice
      await mintTokens(alice);

      const depositAmount = (await crv.balanceOf(alice)) / new BN('3');

      console.log('alice crv deposit amount', depositAmount.toString());
      expect(new BN(depositAmount)).to.be.bignumber.gt(ZERO);

      // convert crv into cvxCrv
      const cvxCrvBalanceBefore = await cvxCrv.balanceOf(alice);
      const crvAmount = await crv.balanceOf(alice);
      await crv.approve(cvxCrvStrategy.address, crvAmount, { from: alice });
      await cvxCrvStrategy.convertTokens(crvAmount, { from: alice });
      const cvxCrvBalanceAfter = await cvxCrv.balanceOf(alice);

      console.log('cvxcrv balance before\t', cvxCrvBalanceBefore.toString());
      console.log('cvxcrv balance after\t', cvxCrvBalanceAfter.toString());
    });
    it('convert CRV tokens into cvxCRV and stake', async () => {
      expect(await cvxCrvVault.claimFeesEnabled()).to.be.true;

      // mint cvx, crv tokens to alice
      await mintTokens(alice);

      const depositAmount = (await crv.balanceOf(alice)) / new BN('3');

      console.log('alice crv deposit amount', depositAmount.toString());
      // expect(new BN(depositAmount)).to.be.bignumber.gt(ZERO);

      // convert crv into cvxCrv
      const cvxCrvBalanceBefore = await cvxCrv.balanceOf(alice);
      const crvAmount = await crv.balanceOf(alice);
      await crv.approve(cvxCrvStrategy.address, crvAmount, { from: alice });
      await cvxCrvStrategy.convertAndStakeTokens(crvAmount, { from: alice });
      const cvxCrvBalanceAfter = await cvxCrv.balanceOf(alice);
      const stakedBalance = await cvxCrvVault.balanceOf(alice);
      
      console.log('cvxcrv balance before\t', cvxCrvBalanceBefore.toString());
      console.log('cvxcrv balance after\t', cvxCrvBalanceAfter.toString());
      console.log('staked balance\t', stakedBalance.toString());
    });
    xit('stake cvxCRV tokens', async () => {
      expect(await cvxCrvVault.claimFeesEnabled()).to.be.true;

      // mint cvx, crv tokens to alice
      await mintTokens(alice);

      const depositAmount = (await crv.balanceOf(alice)) / new BN('3');

      console.log('alice crv deposit amount', depositAmount.toString());
      // expect(new BN(depositAmount)).to.be.bignumber.gt(ZERO);

      // convert crv into cvxCrv
      const cvxCrvBalanceBefore = await cvxCrv.balanceOf(alice);
      const crvAmount = await crv.balanceOf(alice);
      await crv.approve(cvxCrvStrategy.address, crvAmount, { from: alice });
      await cvxCrvStrategy.convertTokens(crvAmount, { from: alice });
      const cvxCrvBalanceAfter = await cvxCrv.balanceOf(alice);

      console.log('cvxcrv balance before\t', cvxCrvBalanceBefore.toString());
      console.log('cvxcrv balance after\t', cvxCrvBalanceAfter.toString());
      await logBalance(alice, 'user balances after convert');

      await cvxCrv.approve(cvxCrvVault.address, cvxCrvBalanceAfter, { from: alice });
      await cvxCrvVault.deposit(cvxCrvBalanceAfter, {from: alice });
      await cvxCrvVault.earn({from: owner});
      await logBalance(alice, 'user balances after stake');
      const stakedBalance = await cvxCrvVault.balanceOf(alice);

      console.log('staked balance\t', stakedBalance.toString());
      expect(cvxCrvBalanceAfter.toString()).to.be.equal(stakedBalance.toString());
      console.log('staked ok!');
      await logEarnings(cvxCrvVault, alice, 'alice earned just after deposit');

      await time.increase(days('14'));

      await logEarnings(cvxCrvVault, alice, 'alice earned 14 days later');
      await cvxCrvVault.getReward(true, { from: alice });
      await logEarnings(cvxCrvVault, alice, 'alice earned after get reward');
      await logBalance(alice, 'user balances');
    });
  });
});
