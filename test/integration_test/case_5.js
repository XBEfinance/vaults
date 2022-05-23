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
const distro = require('../../distro.json');
const artifacts = require('../utils/artifacts');

const { ZERO, ZERO_ADDRESS } = constants.utils;
const { days, months } = constants.time;

const {
  HiveStrategy,
  Vault,
  BonusCampaign,
  ReferralProgram,
  StableSwapMockPool,
  StableSwapUSDT,
  ERC20LP,
  BaseRewardPool,
  Booster,
  ERC20CRV,
  ConvexToken,
} = require('../utils/artifacts');

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

  async function deployAndConfigure() {
    hiveVault = await Vault.new();
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

    await referralProgram.configure(
      [
        distro.rinkeby.curve.CRV,
        distro.rinkeby.convex.cvx,
        mockXBE.address,
      ],
      treasury.address,
      registry.address,
    );

    await controller.setVault(
      LPTokenMockPool.address,
      hiveVault.address,
    );

    await controller.setApprovedStrategy(
      LPTokenMockPool.address,
      hiveStrategy.address,
      true,
    );

    await controller.setStrategy(
      LPTokenMockPool.address,
      hiveStrategy.address,
    );

    await hiveStrategy.configure(
      LPTokenMockPool.address,
      controller.address,
      // hiveVault.address,
      people.owner,
      [
        // LPTokenMockPool.address,
        crvRewardsPool.address,
        distro.rinkeby.convex.cvxRewards,
        booster.address,
        distro.rinkeby.convex.pools[0].id,
        distro.rinkeby.curve.CRV,
        distro.rinkeby.convex.cvx,
      ],
    );

    await hiveVault.configure(
      LPTokenMockPool.address, // _initialToken
      controller.address, // _initialController
      people.owner, // _governance
      constants.localParams.vaults.rewardsDuration, // _rewardsDuration
      mockXBE.address, // _tokenToAutostake
      votingStakingRewards.address, // _votingStakingRewards
      true, // _enableFees
      ZERO_ADDRESS, // _teamWallet
      referralProgram.address, // _referralProgram
      treasury.address, // _treasury
      [ // _rewardsTokens
        mockXBE.address,
        distro.rinkeby.curve.CRV,
        distro.rinkeby.convex.cvx,
      ],
      'Hive Vault', // __namePostfix
      'hv', // __symbolPostfix
    );

    await hiveVault.setRewardsDistribution(
      hiveStrategy.address,
    );

    await simpleXBEInflation.setXBEReceiver(
      hiveStrategy.address,
      new BN('2500'),
    );

    await simpleXBEInflation.setXBEReceiver(
      treasury.address,
      new BN('2500'),
    );

    await registry.addVault(hiveVault.address);
  }

  describe('Buy tokens', async () => {
    beforeEach(deployAndConfigure);
    // const { dependentsAddresses } = params;
    it('getting vault lp', async () => {
      const depositAlice = ether('3');
      const depositBob = ether('10');

      // deposit Alice
      // eslint-disable-next-line no-underscore-dangle
      await stableSwapMockPool._mint_for_testing(depositAlice, { from: people.alice });
      await LPTokenMockPool.approve(hiveVault.address, depositAlice, { from: people.alice });
      await hiveVault.deposit(depositAlice, { from: people.alice });
      const lpAlice = await hiveVault.balanceOf(people.alice);
      expect(lpAlice).to.be.bignumber.equal(depositAlice);

      // backend call earn func
      await hiveVault.earn();
      const balanceReward = await crvRewardsPool.balanceOf(hiveStrategy.address);
      expect(balanceReward).to.be.bignumber.equal(depositAlice);

      // someone will call this function for our pool in Booster contract
      await booster.earmarkRewards(new BN('0'));
      // time passes
      await time.increase(months('2'));

      // hiveStrategy's earnings
      // const canClaimAmountCRV = await hiveStrategy.canClaimAmount(crv.address);
      // const cvxRewardSource = await hiveStrategy.rewardTokensToRewardSources(cvx.address);
      // const canClaimAmountCVX = await hiveStrategy.canClaimAmount(cvx.address);
      // expect(canClaimAmountCRV).to.be.bignumber.gt(new BN('0'));
      // expect(canClaimAmountCVX).to.be.bignumber.gt(new BN('0'));
      // deposit Bob
      // eslint-disable-next-line no-underscore-dangle
      // await stableSwapUSDT._mint_for_testing(depositBob, { from: people.bob });
      // await LPTokenMockPool.approve(hiveVault.address, depositBob, { from: people.bob });
      //
      // await hiveVault.deposit(depositBob, { from: people.bob });
      // const lpBob = await hiveVault.balanceOf(people.bob);
      // const total = await hiveVault.totalSupply();
      //
      // // deposit * totalSupply() / balance()
      // expect(lpBob).to.be.bignumber.equal(ether('3'));
      // // alice + bob LP
      // expect(total).to.be.bignumber.equal(ether('6'));
      // // backend call earn func
      // await hiveVault.earn();
      // // someone will call this function for our pool in Booster contract
      // await booster.earmarkRewards('0');
      // // time passes
      // await time.increase(months('1'));
      // // someone will call this function for our pool in Booster contract
      // await booster.earmarkRewards('0');
      //
      // const balanceRewardAfterBob = await crvRewardsPool.balanceOf(hiveStrategy.address);
      // // deposit Alice + depoist Bob
      // expect(balanceRewardAfterBob).to.be.bignumber.equal(depositAlice.add(depositBob));
      // const earnedVirtualBob = await hiveVault.earnedVirtual.call({ from: people.bob });
      // const canClaimStrategy = await hiveStrategy.canClaimAmount.call();
      // console.log(earnedVirtualBob.toString());
      // console.log(canClaimStrategy.toString());
      // claim real for alice

      // backend called getRewards for specified strategy
      // await controller.getRewardStrategy(LPTokenMockPool.address);
      await hiveStrategy.getRewards();
      console.log((await cvx.balanceOf(hiveStrategy.address)).toString());
      // const balanceAtContract = await hiveStrategy.earned.call();

      let [crvEarned, cvxEarned, xbeEarned] = [0, 0, 0];
      const logRewards = async () => {
        crvEarned = await hiveVault.earned(distro.rinkeby.curve.CRV, alice);
        cvxEarned = await hiveVault.earned(distro.rinkeby.convex.cvx, alice);
        xbeEarned = await hiveVault.earned(mockXBE.address, alice);
        console.log(`alice earned crv: ${crvEarned}, cvx: ${cvxEarned}, xbe: ${xbeEarned}`);
      }

      console.log('before update rewards');
      await logRewards();

      await hiveVault.getReward(true);
      console.log('after update rewards');
      await logRewards();

      // TO-DO: ПРОВЕРИТЬ ЛОГИ!!!!
      // const { logs } = await hiveVault.claim({ from: people.alice });

      const crvBalance = await crv.balanceOf(people.alice);
      const xbeBalance = await mockXBE.balanceOf(people.alice);
      const cvxBalance = await cvx.balanceOf(people.alice);

      console.log('alice balances:');
      console.log(`crv: ${crvBalance}, cvx: ${cvxBalance}, xbe: ${xbeBalance}`);

      // check real alice's balance
      // expect(crvEarned).to.be.bignumber.equal(claimCRV);
      // expect(cvxEarned).to.be.bignumber.equal(claimCVX);
      // expect(xbeEarned).to.be.bignumber.equal(claimXBE);

      // claim virtual for bob

      time.increase(months('1'));

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
