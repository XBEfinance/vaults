/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-vars: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const common = require('./utils/common.js');
const utilsConstants = require('./utils/constants.js');
const artifacts = require('./utils/artifacts.js');
const environment = require('./utils/environment.js');
const { people, setPeople } = require('./utils/accounts.js');

let owner;
let alice;
let bob;
let charlie;

let mockXBE;
let mockCVX;
let mockCRV;
let vault;

let referralProgram;

const deployAndConfigureReferralProgram = async () => {
  [
    referralProgram
  ] = await environment.getGroup(
    [
      'Treasury',
      'Registry',
      'ReferralProgram'
    ],
    (key) => {
      return [
        "ReferralProgram"
      ].includes(key);
    },
    true,
    {
      'Treasury': {
        1: ZERO_ADDRESS
      }
    }
  );
}

contract('ReferralProgram', (accounts) => {

  setPeople(accounts);

  beforeEach(async () => {
    owner = await common.waitFor("owner", people);
    alice = await common.waitFor("alice", people);
    bob = await common.waitFor("bob", people);
    charlie = await common.waitFor("charlie", people);
    [
      mockXBE,
      mockCRV,
      mockCVX,
      vault
    ] = await environment.getGroup(
      [
        'MockXBE',
        'MockCRV',
        'MockCVX',
        'MockToken'
      ],
      (key) => true,
      true
    );
  });

  describe('Configuration', () => {
    beforeEach(deployAndConfigureReferralProgram);

    it('should be correct configured', async () => {
      const config = {
        tokens: [
          mockCRV.address,
          mockCVX.address,
          mockXBE.address,
        ],
        registry: await artifacts.MockContract.new(),
        root: owner,
      };

      await expectRevert(
        referralProgram.configure([ZERO_ADDRESS], ZERO_ADDRESS, ZERO_ADDRESS),
        'RProotIsZero',
      );

      await expectRevert(
        referralProgram.configure([], config.root, ZERO_ADDRESS),
        'RPregistryIsZero',
      );

      await expectRevert(
        referralProgram.configure([], config.root, config.registry),
        'RPtokensNotProvided',
      );

      await expectRevert(
        referralProgram.configure([ZERO_ADDRESS], config.root),
        'RPtokenIsZero',
      );

      await referralProgram.configure(config.tokens, config.root);

      const tokens = await referralProgram.getTokensList();

      expect(tokens).to.deep.equal(config.tokens);

      const rootUser = await referralProgram.users(owner);
      expect(rootUser.exists).to.be.true;
      expect(rootUser.referrer).to.be.bignumber.equal(owner);

      await expectRevert(
        referralProgram.configure(config.tokens, config.root),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('Register', () => {
    beforeEach(deployAndConfigureReferralProgram);

    it('should revert', async () => {
      await expectRevert(
        referralProgram.registerUser(owner),
        'RPuserExists',
      );

      await expectRevert(
        referralProgram.methods['registerUser(address)'](bob, { from: alice }),
        'RP!referrerExists',
      );
    });

    it('should register user correctly', async () => {
      let aliceUser = await referralProgram.users(alice);
      expect(aliceUser.exists).to.be.false;
      expect(aliceUser.referrer).to.be.bignumber.equal(ZERO_ADDRESS);

      await referralProgram.methods['registerUser(address)'](owner, { from: alice });
      aliceUser = await referralProgram.users(alice);
      expect(aliceUser.exists).to.be.true;
      expect(aliceUser.referrer).to.be.bignumber.equal(owner);
    });
  });

  describe('Rewards', () => {
    beforeEach(deployAndConfigureReferralProgram);
    async function registerUsers() {
      await referralProgram.methods['registerUser(address)'](owner, { from: alice });
      await referralProgram.methods['registerUser(address)'](alice, { from: bob });
      await referralProgram.methods['registerUser(address)'](bob, { from: charlie });
    }

    async function getRewards(userAddress, tokens) {
      const rewards = [];
      for (const token of tokens) {
        rewards[token] = await referralProgram.rewards(userAddress, token);
      }
      return rewards;
    }

    async function getUsersRewards(users, tokens) {
      const usersRewards = [];
      for (const user of users) {
        usersRewards[user] = await getRewards(user, tokens);
      }
      return usersRewards;
    }

    function calcPercentage(value, percentage) {
      return value.div(new BN(100)).mul(new BN(percentage));
    }

    function checkRewards(rewards, value) {
      for (const token in rewards) {
        if (Object.prototype.hasOwnProperty.call(rewards, token)) {
          expect(rewards[token]).to.be.bignumber.equal(value);
        }
      }
    }

    async function getUsersTokensBalances(users, tokens) {
      const usersBalances = [];
      for (const user of users) {
        const userBalances = [];
        for (const token of tokens) {
          userBalances[token] = await (await artifacts.MockToken.at(token)).balanceOf(user);
        }
        usersBalances[user] = userBalances;
      }
      return usersBalances;
    }

    it('should register user that not yet registered when reward notified', async () => {
      const tokens = await referralProgram.getTokensList();
      const amounts = Array(tokens.length).fill(ether('100'));
      const rootAddress = await referralProgram.rootAddress();

      const feeReceiving = await referralProgram.feeReceiving(alice, tokens, amounts);
      expectEvent(feeReceiving, 'RegisterUser', {
        user: alice,
        referrer: rootAddress,
      });
      const aliceUser = await referralProgram.users(alice);
      expect(aliceUser.exists).to.be.true;
      expect(aliceUser.referrer).to.be.bignumber.equal(owner);
    });

    it('should correct distribute rewards', async () => {
      const value = ether('100');
      const tokens = await referralProgram.getTokensList();
      const amounts = Array(tokens.length).fill(value);

      await registerUsers();

      await referralProgram.feeReceiving(charlie, tokens[0], amounts);

      const ownerRewards = await getRewards(owner, tokens);
      const aliceRewards = await getRewards(alice, tokens);
      const bobRewards = await getRewards(bob, tokens);
      const charlieRewards = await getRewards(charlie, tokens);

      checkRewards(ownerRewards, calcPercentage(value, '10'));
      checkRewards(aliceRewards, calcPercentage(value, '20'));
      checkRewards(bobRewards, calcPercentage(value, '70'));
      checkRewards(charlieRewards, ZERO);
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
        charlie,
      ];

      // Transfer tokens to RefProgram
      for (const token of tokens) {
        await (await artifacts.MockToken.at(token)).transfer(referralProgram.address, ether('100'));
      }

      // Notify RefProgram
      await referralProgram.feeReceiving(charlie, tokens[0], amounts);

      const uRewardsBefore = await getUsersRewards(users, tokens);
      const uTokensBefore = await getUsersTokensBalances(users, tokens);

      await referralProgram.claimRewardsForRoot();
      await referralProgram.claimRewards({ from: alice });
      await referralProgram.claimRewardsFor(bob);

      const uRewardsAfter = await getUsersRewards(users, tokens);
      const uTokensAfter = await getUsersTokensBalances(users, tokens);

      for (const user of users) {
        for (const token of tokens) {
          const expectedTokenBalance = uTokensBefore[user][token]
            .add(uRewardsBefore[user][token]);

          // global.console.log(`Token [${token}]:
          //   expected token balance: ${expectedTokenBalance}
          //   token balance before: ${uTokensBefore[user][token]}
          //   actual token balance: ${uTokensAfter[user][token]}
          //   reward after: ${uRewardsAfter[user][token]}
          //   reward before: ${uRewardsBefore[user][token]}`);

          expect(uRewardsAfter[user][token]).to.be.bignumber.equal(ZERO);
          expect(uTokensAfter[user][token]).to.be.bignumber.equal(expectedTokenBalance);
        }
      }
    });
  });

  describe('Ownership', () => {
    beforeEach(deployAndConfigureReferralProgram);

    it('should revert if not admin', async () => {
      expectRevert(referralProgram.transferOwnership(alice, { from: alice }), '!admin');
    });

    it('should revert if future admin is zero', async () => {
      await expectRevert(
        referralProgram.transferOwnership(ZERO_ADDRESS, { from: owner }),
        'RPadminIsZero',
      );
    });

    it('should correct transfer ownership', async () => {
      const transferOwnership = await referralProgram
        .transferOwnership(alice, { from: owner });
      expectEvent(transferOwnership, 'TransferOwnership', { admin: alice });

      const admin = await referralProgram.admin();
      expect(admin).to.be.bignumber.equal(alice);
    });
  });
});
