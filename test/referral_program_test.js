/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-vars: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');

const common = require('./utils/common.js');
const utilsConstants = require('./utils/constants.js');
const artifacts = require('./utils/artifacts.js');
const environment = require('./utils/environment.js');
const { people, setPeople } = require('./utils/accounts.js');
const { ZERO, ZERO_ADDRESS } = utilsConstants;

let owner;
let alice;
let bob;
let charlie;

let mockXBE;
let mockCVX;
let mockCRV;
let vault;

let treasury;
let registry;
let referralProgram;
let mock;

const deployReferralProgram = async () => {
  [
    // treasury,
    registry,
    referralProgram
  ] = await environment.getGroup(
    [
      // 'Treasury',
      'Registry',
      'ReferralProgram'
    ],
    (key) => true,
    true,
    {
      'Treasury': {
        1: ZERO_ADDRESS
      }
    }
  );
}

const configureReferralProgram = async () => {

  mock = await artifacts.MockContract.new();
  registry = await artifacts.Registry.at(mock.address);

  const getVaultsInfoCalldata = registry.contract.methods.getVaultsInfo().encodeABI();
  await mock.givenMethodReturn(
    getVaultsInfoCalldata,
    web3.eth.abi.encodeParameters(
      [
        "address[]", "address[]", "address[]", "address[]",
        "bool[]", "bool[]"
      ],
      [[owner, vault.address], [], [], [], [], []]
    )
  );

  await referralProgram.configure(
    [
      mockXBE.address,
      mockCRV.address,
      mockCVX.address,
    ],
    owner,
    registry.address,
    { from: owner }
  );
};

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
    beforeEach(async () => {
      await deployReferralProgram();
    });

    it('should be correct configured', async () => {
      const config = {
        tokens: [
          mockCRV.address,
          mockCVX.address,
          mockXBE.address,
        ],
        registry: (await artifacts.MockContract.new()).address,
        root: people.owner,
        // registry: registry.address,
      };

      // await referralProgram.configure([ZERO_ADDRESS], ZERO_ADDRESS, ZERO_ADDRESS);
      await expectRevert(
        referralProgram.configure([ZERO_ADDRESS], ZERO_ADDRESS, ZERO_ADDRESS, { from: owner }),
        'RProotIsZero',
      );

      // await referralProgram.configure([ZERO_ADDRESS], ZERO_ADDRESS, ZERO_ADDRESS);
      await expectRevert(
        referralProgram.configure([], config.root, ZERO_ADDRESS, { from: people.owner }),
        'RPregistryIsZero',
      );

      await expectRevert(
        referralProgram.configure([], config.root, config.registry, { from: owner }),
        'RPtokensNotProvided',
      );

      await expectRevert(
        referralProgram.configure([ZERO_ADDRESS], config.root, config.registry, { from: owner }),
        'RPtokenIsZero',
      );

      await referralProgram.configure(config.tokens, config.root, config.registry, { from: people.owner });

      const tokens = await referralProgram.getTokensList();

      expect(tokens).to.deep.equal(config.tokens);

      const registryAddress = await referralProgram.registry();
      expect(registryAddress).to.be.bignumber.equal(config.registry);

      const rootUser = await referralProgram.users(people.owner);
      expect(rootUser.exists).to.be.true;
      expect(rootUser.referrer).to.be.bignumber.equal(people.owner);

      await expectRevert(
        referralProgram.configure(config.tokens, config.root, config.registry, { from: people.owner }),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('Register', () => {
    beforeEach(async () => {
      await deployReferralProgram();
      await configureReferralProgram();
    });

    it('should revert', async () => {
      await expectRevert(
        referralProgram.registerUser(people.owner),
        'RPuserExists',
      );

      await expectRevert(
        referralProgram.methods['registerUser(address)'](people.bob, { from: people.alice }),
        'RP!referrerExists',
      );

      await expectRevert(
        referralProgram.methods['registerUser(address,address)'](
          people.owner,
          people.alice,
          { from: people.alice },
        ),
        'RP!feeDistributor',
      );
    });

    it('should register user correctly', async () => {
      let aliceUser = await referralProgram.users(people.alice);
      expect(aliceUser.exists).to.be.false;
      expect(aliceUser.referrer).to.be.bignumber.equal(ZERO_ADDRESS);

      await referralProgram.methods['registerUser(address)'](people.owner, { from: people.alice });
      aliceUser = await referralProgram.users(people.alice);
      expect(aliceUser.exists).to.be.true;
      expect(aliceUser.referrer).to.be.bignumber.equal(people.owner);
    });

    it('should register user from feeDistributor correctly', async () => {
      let aliceUser = await referralProgram.users(people.alice);
      expect(aliceUser.exists).to.be.false;
      expect(aliceUser.referrer).to.be.bignumber.equal(ZERO_ADDRESS);

      await referralProgram.methods['registerUser(address,address)'](
        people.owner,
        people.alice,
        { from: people.owner },
      );
      aliceUser = await referralProgram.users(people.alice);
      expect(aliceUser.exists).to.be.true;
      expect(aliceUser.referrer).to.be.bignumber.equal(people.owner);
    });
  });

  describe('Rewards', () => {

    beforeEach(async () => {
      await deployReferralProgram();
      await configureReferralProgram();
    });

    async function registerUsers() {
      await referralProgram.methods['registerUser(address)'](people.owner, { from: people.alice });
      await referralProgram.methods['registerUser(address)'](people.alice, { from: people.bob });
      await referralProgram.methods['registerUser(address)'](people.bob, { from: people.carol });
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
      return value.mul(new BN(percentage)).div(new BN('100'));
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

    it('should revert if feeReceiving() called by not approved distributor', async () => {
      const tokens = await referralProgram.getTokensList();
      const amount = ether('100');
      await expectRevert(
        referralProgram.feeReceiving(people.alice, tokens[0], amount, { from: people.alice }),
        'RP!feeDistributor',
      );
    });

    it('should register user that not registered when reward notified', async () => {
      const tokens = await referralProgram.getTokensList();
      const amount = ether('100');
      const rootAddress = await referralProgram.rootAddress();

      const feeReceiving = await referralProgram.feeReceiving(people.alice, tokens[0], amount);

      expectEvent(feeReceiving, 'RegisterUser', {
        user: people.alice,
        referrer: rootAddress,
      });

      const aliceUser = await referralProgram.users(people.alice);
      expect(aliceUser.exists).to.be.true;
      expect(aliceUser.referrer).to.be.bignumber.equal(people.owner);
    });

    it('should correct distribute rewards', async () => {
      const value = ether('100');
      const tokens = [(await referralProgram.getTokensList())[0]];
      const amounts = [Array(tokens.length).fill(value)[0]];

      await registerUsers();

      for (let i = 0; i < tokens.length; i += 1) {
        await referralProgram.feeReceiving(people.carol, tokens[i], amounts[i]);
      }

      const ownerRewards = await getRewards(people.owner, tokens);
      const aliceRewards = await getRewards(people.alice, tokens);
      const bobRewards = await getRewards(people.bob, tokens);
      const carolRewards = await getRewards(people.carol, tokens);

      checkRewards(ownerRewards, calcPercentage(value, '10'));
      checkRewards(aliceRewards, calcPercentage(value, '20'));
      checkRewards(bobRewards, calcPercentage(value, '70'));
      checkRewards(carolRewards, utilsConstants.utils.ZERO);
    });

    it('should claim reward correctly', async () => {
      const value = ether('100');
      const tokens = [(await referralProgram.getTokensList())[0]];
      const amounts = [Array(tokens.length).fill(value)[0]];

      await registerUsers();

      const users = [
        people.owner,
        people.alice,
        people.bob,
        people.carol,
      ];

      // Transfer tokens to RefProgram
      for (const token of tokens) {
        await (await artifacts.MockToken.at(token)).transfer(referralProgram.address, ether('100'));
      }

      // Notify RefProgram
      for (let i = 0; i < tokens.length; i += 1) {
        await referralProgram.feeReceiving(people.carol, tokens[i], amounts[i]);
      }

      const uRewardsBefore = await getUsersRewards(users, tokens);
      const uTokensBefore = await getUsersTokensBalances(users, tokens);

      await referralProgram.claimRewardsForRoot();
      await referralProgram.claimRewards({ from: people.alice });
      await referralProgram.claimRewardsFor(people.bob);

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

    beforeEach(async () => {
      await deployReferralProgram();
      await configureReferralProgram();
    });

    it('should revert if not admin', async () => {
      expectRevert(referralProgram.transferOwnership(people.alice, { from: people.alice }), '!admin');
    });

    it('should revert if future admin is zero', async () => {
      await expectRevert(
        referralProgram.transferOwnership(ZERO_ADDRESS, { from: people.owner }),
        'RPadminIsZero',
      );
    });

    it('should correct transfer Ownership', async () => {
      const transferOwnership = await referralProgram
        .transferOwnership(people.alice, { from: people.owner });
      expectEvent(transferOwnership, 'TransferOwnership', { admin: people.alice });

      const admin = await referralProgram.admin();
      expect(admin).to.be.bignumber.equal(people.alice);
    });
  });

  describe('Token distribution and list', () => {
    beforeEach(async () => {
      await deployReferralProgram();
      await configureReferralProgram();
    });

    it('should correctly change distribution', async () => {
      await expectRevert(
        referralProgram.changeDistribution(Array(3).fill(new BN('10'))),
        'RP!fullDistribution',
      );
      const newDistribution = Array(4).fill(new BN('25'));
      const changeDistributionReceipt = await referralProgram.changeDistribution(newDistribution);
      const actualDistribution = await referralProgram.getDistributionList();
      expectEvent(changeDistributionReceipt, 'NewDistribution', {
        distribution: Array(4).fill(new BN('25')),
      });
      expect(actualDistribution).to.deep.equal(Array(4).fill(new BN('25')));
    });

    it('should correctly add new token', async () => {
      const oldTokensList = await referralProgram.getTokensList();

      await expectRevert(
        referralProgram.addNewToken(ZERO_ADDRESS),
        'RPtokenIsZero',
      );

      await expectRevert(
        referralProgram.addNewToken(mockXBE.address),
        'RPtokenAlreadyExists',
      );

      const mockToken = await artifacts.MockToken.new('Mock Token', 'MT', ether('123'));

      const newTokenReceipt = await referralProgram.addNewToken(mockToken.address);
      const newTokensList = await referralProgram.getTokensList();
      expectEvent(newTokenReceipt, 'NewToken', {
        token: mockToken.address,
      });
      expect(newTokensList).to.deep.equal([...oldTokensList, mockToken.address]);
    });
  });
});
