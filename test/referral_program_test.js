/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require("chai");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require("@openzeppelin/test-helpers");
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require("./utils/common.js");
const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
} = require("./utils/deploy_infrastructure.js");


const { ZERO_ADDRESS } = constants;
const MockContract = artifacts.require("MockContract");
const MockToken = artifacts.require("MockToken");

contract("ReferralProgram", (accounts) => {

    const owner = accounts[0];
    const alice = accounts[1];
    const bob = accounts[2];
    const carol = accounts[3];

  
    let mockXBE;
    let mockCRV;
    let mockCVX;
    let xbeInflation;
    let bonusCampaign;
    let minter;
    let gaugeController;
    let veXBE;
    let voting;
    let stakingRewards;
    let liquidityGaugeReward;
    let vaultWithXBExCRVStrategy;
    let referralProgram;
  
    let deployment;
    
  async function deploy() {
    deployment = deployInfrastructure(owner, alice, bob, defaultParams);
    [
      mockXBE,
      mockCRV,
      mockCVX,
      xbeInflation,
      bonusCampaign,
      minter,
      gaugeController,
      veXBE,
      voting,
      stakingRewards,
      liquidityGaugeReward,
      referralProgram
    ] = await deployment.proceed();
  }

  async function deployAndConfigure() {
    await deploy();
    await deployment.configure();
  }

  beforeEach(async () => {
    vaultWithXBExCRVStrategy = await getMockTokenPrepared(
      alice,
      ether("100"),
      ether("1000"),
      owner
    );
    await vaultWithXBExCRVStrategy.approve(bob, ether("100"));
    await vaultWithXBExCRVStrategy.transfer(bob, ether("100"));
    defaultParams.vaultWithXBExCRVStrategyAddress =
      vaultWithXBExCRVStrategy.address;
  });

  describe('Configuration', () => {
    beforeEach(deploy);

    it('should be correct configured', async () => {
      const config = {
        tokens: [
          mockCRV.address,
          mockCVX.address,
          mockXBE.address
        ],
        root: owner
      };

      await expectRevert(
        referralProgram.configure([ZERO_ADDRESS], ZERO_ADDRESS),
        'rootIsZero'
      );

      await expectRevert(
        referralProgram.configure([], config.root),
        'tokensNotProvided'
      );

      await expectRevert(
        referralProgram.configure([ZERO_ADDRESS], config.root),
        'tokenIsZero'
      );

      await referralProgram.configure(config.tokens, config.root);

      const tokens = await referralProgram.getTokensList();

      expect(tokens).to.deep.equal(config.tokens);

      const rootUser = await referralProgram.users(owner);
      expect(rootUser.exists).to.be.true;
      expect(rootUser.referrer).to.be.bignumber.equal(owner);

      await expectRevert(
        referralProgram.configure(config.tokens, config.root),
        'Initializable: contract is already initialized'
      );
    });

    describe('Register', () => {
      beforeEach(deployAndConfigure);

      it('should revert', async () => {
        await expectRevert(
          referralProgram.registerUser(owner),
          'RPuserExists');
        
        await expectRevert(
          referralProgram.methods["registerUser(address)"](bob, { from: alice }),
          'RP!referrerExists'
        );
      });

      it('should register user correctly', async () => {
        let aliceUser = await referralProgram.users(alice);
        expect(aliceUser.exists).to.be.false;
        expect(aliceUser.referrer).to.be.bignumber.equal(ZERO_ADDRESS);

        await referralProgram.methods["registerUser(address)"](owner, { from: alice });
        aliceUser = await referralProgram.users(alice);
        expect(aliceUser.exists).to.be.true;
        expect(aliceUser.referrer).to.be.bignumber.equal(owner);

      });
    });

    describe('Rewards', () => {
      beforeEach(deployAndConfigure);

      async function registerUsers(){
        await referralProgram.methods["registerUser(address)"](owner, { from: alice });
        await referralProgram.methods["registerUser(address)"](alice, { from: bob });
        await referralProgram.methods["registerUser(address)"](bob, { from: carol });


      };

      async function getRewards(userAddress, tokens){
        const rewards = [];
        for(const token of tokens){
          rewards[token] = await referralProgram.rewards(userAddress, token);
        }
        return rewards;
      }

      async function getUsersRewards(users, tokens){
        const usersRewards = [];
        for(const user of users){
          usersRewards[user] = await getRewards(user, tokens);
        }
        return usersRewards;
      }

      function calcPercentage(value, percentage) {
        return value.div(new BN(100)).mul(new BN(percentage));
      }

      function checkRewards(rewards, value){
        for(const token in rewards){
          if (Object.prototype.hasOwnProperty.call(rewards, token)) {
            expect(rewards[token]).to.be.bignumber.equal(value);
          }
        }
      }

      async function getUsersTokensBalances(users, tokens){
        const usersBalances = [];
        for(const user of users){
          const userBalances = [];
          for(const token of tokens){
            userBalances[token] = await (await MockToken.at(token)).balanceOf(user);
          }
          usersBalances[user] = userBalances;
        }
        return usersBalances;
      }

      it('should register user that not yet registered when reward notified', async () => {
        const tokens = await referralProgram.getTokensList();
        const amounts = Array(tokens.length).fill(ether('100'));

        await referralProgram.feeReceiving(alice, tokens, amounts);
        const aliceUser = await referralProgram.users(alice);
        expect(aliceUser.exists).to.be.true;
        expect(aliceUser.referrer).to.be.bignumber.equal(owner);
      });

      it('should correct distribute rewards', async () => {
        const value = ether('100');
        const tokens = await referralProgram.getTokensList();
        const amounts = Array(tokens.length).fill(value);

        await registerUsers();

        await referralProgram.feeReceiving(carol, tokens, amounts);

        const ownerRewards = await getRewards(owner, tokens);
        const aliceRewards = await getRewards(alice, tokens);
        const bobRewards = await getRewards(bob, tokens);
        const carolRewards = await getRewards(carol, tokens);


        checkRewards(ownerRewards, calcPercentage(value, '10'));
        checkRewards(aliceRewards, calcPercentage(value, '20'));
        checkRewards(bobRewards, calcPercentage(value, '70'));
        checkRewards(carolRewards, ZERO);
        
      });

      it('should claim reward correctly', async () => {
        const value = ether('100');
        const tokens = await referralProgram.getTokensList();
        const amounts = Array(tokens.length).fill(value);

        await registerUsers();
        
        const users = [
          owner,
          alice,
          bob,
          carol
        ];

        for(const token of tokens){
          await (await MockToken.at(token)).transfer(referralProgram.address, ether('100'));
        }

        await referralProgram.feeReceiving(carol, tokens, amounts);
        
        const uRewardsBefore = await getUsersRewards(users, tokens);
        const uTokensBefore = await getUsersTokensBalances(users, tokens);

        await referralProgram.claimRewards();
        await referralProgram.claimRewardsFor(alice);
        await referralProgram.claimRewardsFor(bob);   

        const uRewardsAfter = await getUsersRewards(users, tokens);
        const uTokensAfter = await getUsersTokensBalances(users, tokens);
        
        for(const user of users){
          // console.log(`User: [${user}]:`)
          for(const token of tokens){
            const expectedTokenBalance = uTokensBefore[user][token]
              .add(uRewardsBefore[user][token]);
            
            // console.log(`Token [${token}]:
            //   expected token balance: ${expectedTokenBalance}
            //   actual token balance: ${uTokensAfter[user][token]}
            //   reward after: ${uRewardsAfter[user][token]}
            //   reward before: ${uRewardsBefore[user][token]}`
            // );
                        
            expect(uRewardsAfter[user][token]).to.be.bignumber.equal(ZERO);
            expect(uTokensAfter[user][token]).to.be.bignumber.equal(expectedTokenBalance);
          }
        }
      });

    });

    describe('Ownership', () => {
      beforeEach(deployAndConfigure);
  
      it('should revert if not admin', async () => {
        expectRevert(referralProgram.commitTransferOwnership(alice, { from: alice }), '!admin');
      });
  
      it('should revert if future admin is zero', async () => {
        const commitTransferOwnership = await referralProgram.commitTransferOwnership(ZERO_ADDRESS, { from: owner });
        expectEvent(commitTransferOwnership, 'CommitOwnership', { admin: ZERO_ADDRESS });
    
        await expectRevert(referralProgram.applyTransferOwnership({ from: owner }), 'adminIsZero');
      });
  
      it('should correct transfer ownership', async () => {
        const commitTransferOwnership = await referralProgram.commitTransferOwnership(alice, { from: owner });
        const futureAdmin = await referralProgram.futureAdmin();
        expectEvent(commitTransferOwnership, 'CommitOwnership', { admin: alice });
        expect(futureAdmin).to.be.bignumber.equal(alice);
    
        const applyTransferOwnership = await referralProgram.applyTransferOwnership({ from: owner });
        const admin = await referralProgram.admin();
        expectEvent(applyTransferOwnership, 'ApplyOwnership', { admin: alice });
        expect(admin).to.be.bignumber.equal(alice);
      });
    });
  });

});