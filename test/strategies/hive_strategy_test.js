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

//     struct PoolInfo {
//         address lptoken;
//         address token;
//         address gauge;
//         address crvRewards;
//         address stash;
//         bool shutdown;
//     }

contract('Curve LP Testing', (accounts) => {
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
  let referralProgram;
  let registry;
  let stableSwapUSDT;
  let crvRewardsPool;
  let booster;
  let crv;
  let cvx;
  let LPTokenMockPool;
  let stableSwapMockPool;
  let mock;
  let owner;
  let alice;
  let bob;
  let wallet;

  async function deployAndConfigure() {
    owner = people.owner;
    alice = people.alice;
    bob = people.bob;
    wallet = people.tod;

    hiveVault = await HiveVault.new();
    hiveStrategy = await HiveStrategy.new();
    referralProgram = await ReferralProgram.new();
    stableSwapMockPool = await StableSwapMockPool
      .at(distro.rinkeby.curve.pool_data.mock_pool.swap_address);
    LPTokenMockPool = await ERC20LP.at(distro.rinkeby.convex.pools[0].lptoken);
    crvRewardsPool = await BaseRewardPool.at(distro.rinkeby.convex.pools[0].crvRewards);
    booster = await Booster.at(distro.rinkeby.convex.booster);
    cvx = await ConvexToken.at(distro.rinkeby.convex.cvx);
    crv = await ERC20CRV.at(distro.rinkeby.curve.CRV);
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

    console.log('set xbe receivers');
    await simpleXBEInflation.setXBEReceiver(
      hiveStrategy.address,
      new BN('2500'),
    );

    await simpleXBEInflation.setXBEReceiver(
      treasury.address,
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

  describe('Buy tokens', async () => {
    beforeEach(deployAndConfigure);

    xit('properly configured', async () => {
      const vault = hiveVault;
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
    });

    // const { dependentsAddresses } = params;
    it('getting vault lp', async () => {
      expect(await hiveVault.feesEnabled()).to.be.false;

      const depositAlice = ether('3');
      const depositBob = ether('10');

      // deposit Alice
      // eslint-disable-next-line no-underscore-dangle
      await stableSwapMockPool._mint_for_testing(depositAlice, { from: alice });

      await LPTokenMockPool.approve(hiveVault.address, depositAlice, { from: alice });
      await hiveVault.deposit(depositAlice, { from: alice });

      const lpAlice = await hiveVault.balanceOf(alice);
      expect(lpAlice).to.be.bignumber.equal(depositAlice);

      const {
         lptoken,
         token,
         gauge,
         crvRewards,
         stash,
        shutdown,
      } = await booster.poolInfo(0);

      console.log('lptoken', lptoken);
      console.log('token', token);
      console.log('gauge', gauge);
      console.log('crvRewards', crvRewards);
      console.log('stash', stash);
      console.log('shutdown', shutdown);

      // crv lp token (lp token lev.2)
      const tokenInstance = await IERC20.at(token);
      console.log(' == token strategy balance before earn is',
        (await tokenInstance.balanceOf(hiveStrategy.address)).toString()
      );
      console.log('crvRewarsdPool balance before earn is',
        (await tokenInstance.balanceOf(crvRewardsPool.address)).toString()
      );
      console.log(' =!= strategy reward balance before earn is',
        (await crvRewardsPool.balanceOf(hiveStrategy.address)).toString()
      );

      // backend call earn func
      await hiveVault.earn();

      console.log(' == token strategy balance after earn is',
        (await tokenInstance.balanceOf(hiveStrategy.address)).toString()
      );

      console.log(' == crvRewarsdPool balance after earn is',
        (await tokenInstance.balanceOf(crvRewardsPool.address)).toString()
      );

      const balanceReward = await crvRewardsPool.balanceOf(hiveStrategy.address);
      console.log(' =!= strategy reward balance after earn is', balanceReward.toString());
      expect(balanceReward).to.be.bignumber.equal(depositAlice);

      await controller.getRewardStrategy(LPTokenMockPool.address);

      // someone will call this function for our pool in Booster contract
      await booster.earmarkRewards(ZERO);
      // time passes
      await time.increase(months('1'));

      // backend called getRewards for specified strategy
      // await controller.getRewardStrategy(LPTokenMockPool.address);

      // await hiveStrategy.getRewards();
      // console.log((await cvx.balanceOf(hiveStrategy.address)).toString());
      // const balanceAtContract = await hiveStrategy.earned.call();

      const logValues = (msg, v1, v2, v3) => {
        console.log(`${msg}:\tcrv: ${v1},\tcvx: ${v2},\txbe: ${v3}`);
      }

      // let [crvEarned, cvxEarned, xbeEarned] = [0, 0, 0];
      const logEarnings = async (addr, msg) => {
        const crvEarned = await hiveVault.earned(distro.rinkeby.curve.CRV, addr);
        const cvxEarned = await hiveVault.earned(distro.rinkeby.convex.cvx, addr);
        const xbeEarned = await hiveVault.earned(mockXBE.address, addr);
        logValues(msg, crvEarned, cvxEarned, xbeEarned);
      };

      const logRewards = async (addr, msg) => {
        const crvReward = await hiveVault.rewards(addr, distro.rinkeby.curve.CRV);
        const cvxReward = await hiveVault.rewards(addr, distro.rinkeby.convex.cvx);
        const xbeReward = await hiveVault.rewards(addr, mockXBE.address);
        logValues(msg, crvReward, cvxReward, xbeReward);
      };

      const logBalance = async (addr, msg = '') => {
        const crvBalance = await crv.balanceOf(addr);
        const xbeBalance = await mockXBE.balanceOf(addr);
        const cvxBalance = await cvx.balanceOf(addr);
        console.log(`${msg}:\tcrv: ${crvBalance}, cvx: ${cvxBalance}, xbe: ${xbeBalance}`)
      };

      const logUrptp = async (addr, msg = '') => {
        const v1 = await hiveVault.userRewardPerTokenPaid(crv.address, addr);
        const v2 = await hiveVault.userRewardPerTokenPaid(cvx.address, addr);
        const v3 = await hiveVault.userRewardPerTokenPaid(mockXBE.address, addr);
        logValues(msg, v1, v2, v3);
      };

      const logAllRewards = async (msg) => {
        console.log('\n', msg);
        await logEarnings(alice, 'earned');
        await logRewards(alice, 'rewards');
        await logUrptp(alice, 'userrptp');
        await logBalance(alice, 'balances');
        // await logBalance(owner, 'owner balances:');
        // await logBalance(wallet, 'wallet balances:');
        // await logBalance(treasury.address, 'treasury address');
        await logBalance(hiveVault.address, 'HV balances');
        // await logBalance(votingStakingRewards.address, 'VSR balances');
      };

      await logAllRewards('===== before update rewards =====');

      // backend called getRewards for specified strategy
      // await controller.getRewardStrategy(LPTokenMockPool.address);

      await hiveVault.getReward(true, {from: alice});

      await logAllRewards('===== after update rewards =====');

      await time.increase(months('1'));

      await logAllRewards('===== after 1 month passed =====');

      // await hiveVault.earn();

      await hiveVault.getReward(true, {from: alice});
      await logAllRewards('===== after alice get reward =====');

      // console.log('alice deposited', depositAlice.toString());
      // // console.log('balance from booster',
      // //   await booster.balanceOf(hiveStrategy.address));
      // console.log('she has now in vault',
      //   (await crvRewardsPool.balanceOf(hiveStrategy.address)).toString()
      // );
      // console.log('alice crv reward from base vault',
      //   (await hiveVault.userReward(alice, crv.address)).toString()
      // );
      //
      // console.log('alice cvx reward from base vault',
      //   (await hiveVault.userReward(alice, cvx.address)).toString()
      // );
      //
      // console.log('alice xbe reward from base vault',
      //   (await hiveVault.userReward(alice, mockXBE.address)).toString()
      // );
      //
      // console.log('alice lpt balance in hive',
      //   (await hiveVault.balanceOf(alice)).toString()
      // );

      console.log('feeweight count', (await hiveVault.feeReceiversCount()).toString());

      const lpbalance = await LPTokenMockPool.balanceOf(alice);

      await hiveVault.withdraw(depositAlice, {from: alice});

      expect(await LPTokenMockPool.balanceOf(alice))
        .to.be.bignumber.equal(
          depositAlice.add(lpbalance), 'withdrawn value != deposited value'
      );


      // check real alice's balance
      // expect(crvEarned).to.be.bignumber.equal(claimCRV);
      // expect(cvxEarned).to.be.bignumber.equal(claimCVX);
      // expect(xbeEarned).to.be.bignumber.equal(claimXBE);

      // claim virtual for bob

      // time.increase(months('1'));

      // const [crvEarnedVirtual, cvxEarnedVirtual, xbeEarnedVirtual] = await hiveVault.earnedVirtual.call({ from: bob });
      // console.log(crvEarnedVirtual.toString(), cvxEarnedVirtual.toString(), xbeEarnedVirtual.toString());
      // claimAll virtual bob
      // ref program => users => exitst => true

      // deposit with protocol fee

      // withdraw and withdrawAll

      // async function getRewards(userAddress, tokens) {
      //   const rewards = [];
      //   for (const token of tokens) {
      //     rewards[token] = await referralProgram.rewards(userAddress, token);
      //   }
      //   return rewards;
      // }
    });
  });
});
