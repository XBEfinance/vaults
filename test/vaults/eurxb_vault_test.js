/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */
// const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time
} = require('@openzeppelin/test-helpers');
const { accounts, contract } = require('@openzeppelin/test-environment');
const { ZERO_ADDRESS } = constants;

const { ZERO, CONVERSION_WEI_CONSTANT, getMockTokenPrepared } = require('../utils/common');
const { vaultInfrastructureRedeploy } = require('../utils/vault_infrastructure_redeploy');

const IERC20 = contract.fromArtifact("IERC20");
const IStrategy = contract.fromArtifact("IStrategy");
const MockToken = contract.fromArtifact("MockToken");
const Controller = contract.fromArtifact("Controller");

const ConsumerEURxbStrategy = contract.fromArtifact("ConsumerEURxbStrategy");
const InstitutionalEURxbStrategy = contract.fromArtifact("InstitutionalEURxbStrategy");
const UnwrappedToWrappedTokenConverter = contract.fromArtifact("UnwrappedToWrappedTokenConverter");
const WrappedToUnwrappedTokenConverter = contract.fromArtifact("WrappedToUnwrappedTokenConverter");
const TokenWrapper = contract.fromArtifact("TokenWrapper");


const InstitutionalEURxbVault = contract.fromArtifact("InstitutionalEURxbVault");
const ConsumerEURxbVault = contract.fromArtifact("ConsumerEURxbVault");

const MockContract = contract.fromArtifact("MockContract");

const vaultTestSuite = (strategyType, vaultType, isInstitutional) => {
  return () => {
    const governance = accounts[0];
    const miris = accounts[1];
    const strategist = accounts[2];
    const alice = accounts[3];

    const testMin = new BN('9600');

    let revenueToken;
    let controller;
    let strategy;
    let vault;
    let mock;

    beforeEach(async () => {
      [
        mock,
        controller,
        strategy,
        vault,
        revenueToken
      ] = await vaultInfrastructureRedeploy(
        governance,
        strategist,
        strategyType,
        vaultType
      );
      if (isInstitutional) {
        await vault.configure(
          revenueToken.address,
          controller.address,
          ZERO_ADDRESS,
          {from: governance}
        );
      } else {
        await vault.configure(
          revenueToken.address,
          controller.address,
          {from: governance}
        );
      }

    });

    it('should configure successfully', async () => {
      expect(await vault.controller()).to.be.equal(controller.address);
      expect(await vault.governance()).to.be.equal(governance);
      expect(await vault.token()).to.be.equal(revenueToken.address);
      expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
      expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
    });

    if (isInstitutional) {

      const investor = accounts[3];
      let role;

      describe('investor role management', () => {

        beforeEach(async () => {
          role = await vault.INVESTOR();
          await vault.allowInvestor(investor, {from: governance});
        });

        it('should allow investor', async () => {
          expect(await vault.hasRole(role, investor)).to.be.equal(true);
        });

        it('should disallow investor', async () => {
          await vault.disallowInvestor(investor, {from: governance});
          expect(await vault.hasRole(role, investor)).to.be.equal(false);
        });

        it('should renounce investor', async () => {
          await vault.renounceInvestor({from: investor});
          expect(await vault.hasRole(role, investor)).to.be.equal(false);
        });
      });

      describe('wrapping/unwrapping functional', () => {

        let wrapConverter;
        let unwrapConverter;
        let tokenToWrap;
        let wrapper;
        let aliceAmount = ether('5');

        beforeEach(async () => {

          tokenToWrap = await getMockTokenPrepared(alice, ether('10'), ether('20'), governance);

          wrapConverter = await UnwrappedToWrappedTokenConverter.new();
          await wrapConverter.configure(tokenToWrap.address, {from: governance});

          unwrapConverter = await WrappedToUnwrappedTokenConverter.new();
          await unwrapConverter.configure(tokenToWrap.address, {from: governance});

          wrapper = await TokenWrapper.new(
            "Banked EURxb",
            "bEURxb",
            tokenToWrap.address,
            alice,
            {from: governance}
          );
          const MINTER_ROLE = await wrapper.MINTER_ROLE();
          await wrapper.grantRole(MINTER_ROLE, wrapConverter.address, {from: governance});
          await wrapper.grantRole(MINTER_ROLE, unwrapConverter.address, {from: governance});


          vault = await vaultType.new({from: governance});
          strategy = await strategyType.new({from: governance});
          controller = await Controller.new({from: governance});

          await strategy.configure(
            wrapper.address,
            controller.address,
            vault.address,
            {from: governance}
          );

          await controller.configure(
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            {from: governance}
          );

          await controller.setVault(
            wrapper.address,
            vault.address,
            {from: governance}
          );

          await controller.setApprovedStrategy(
            wrapper.address,
            strategy.address,
            true,
            {from: governance}
          );

          await controller.setStrategy(
            wrapper.address,
            strategy.address,
            {from: governance}
          );

          await controller.setApprovedStrategy(
            tokenToWrap.address,
            strategy.address,
            true,
            {from: governance}
          );

          await controller.setStrategy(
            tokenToWrap.address,
            strategy.address,
            {from: governance}
          );

          await vault.configure(
              wrapper.address,
              controller.address,
              tokenToWrap.address,
              {from: governance}
          );

          await vault.allowInvestor(alice, {from: governance});
        });

        it('should revert if suiting converter is not found', async () => {
          const aliceBalance = await tokenToWrap.balanceOf(alice);
          await tokenToWrap.approve(vault.address, aliceAmount, {from: alice});
          await expectRevert(vault.depositUnwrapped(aliceAmount, {from: alice}), "!converter");
        });

        it('should deposit unwrapped', async () => {
          await controller.setConverter(tokenToWrap.address, wrapper.address, wrapConverter.address, {from: governance});
          await controller.setConverter(wrapper.address, tokenToWrap.address, unwrapConverter.address, {from: governance});
          const aliceBalance = await tokenToWrap.balanceOf(alice);
          await tokenToWrap.approve(vault.address, aliceAmount, {from: alice});
          await vault.depositUnwrapped(aliceAmount, {from: alice});
          expect(await vault.balanceOf(alice)).to.be.bignumber.equal(aliceAmount);
          expect(await tokenToWrap.balanceOf(alice)).to.be.bignumber.equal(aliceBalance.sub(aliceAmount));
          expect(await tokenToWrap.balanceOf(wrapper.address)).to.be.bignumber.equal(aliceAmount);
          expect(await wrapper.balanceOf(vault.address)).to.be.bignumber.equal(aliceAmount);
        });

        it('should deposit unwrapped all', async () => {
          await controller.setConverter(tokenToWrap.address, wrapper.address, wrapConverter.address, {from: governance});
          await controller.setConverter(wrapper.address, tokenToWrap.address, unwrapConverter.address, {from: governance});
          const aliceBalance = await tokenToWrap.balanceOf(alice);
          await tokenToWrap.approve(vault.address, aliceBalance, {from: alice});
          await vault.depositAllUnwrapped({from: alice});
          expect(await vault.balanceOf(alice)).to.be.bignumber.equal(aliceBalance);
          expect(await tokenToWrap.balanceOf(alice)).to.be.bignumber.equal(ZERO);
          expect(await tokenToWrap.balanceOf(wrapper.address)).to.be.bignumber.equal(aliceBalance);
          expect(await wrapper.balanceOf(vault.address)).to.be.bignumber.equal(aliceBalance);
        });

        it('should withdraw unwrapped', async () => {
          await controller.setConverter(tokenToWrap.address, wrapper.address, wrapConverter.address, {from: governance});
          await controller.setConverter(wrapper.address, tokenToWrap.address, unwrapConverter.address, {from: governance});
          const aliceBalance = await tokenToWrap.balanceOf(alice);
          await tokenToWrap.approve(vault.address, aliceAmount, {from: alice});
          await vault.depositUnwrapped(aliceAmount, {from: alice});

          expect(await vault.balanceOf(alice)).to.be.bignumber.equal(aliceAmount);
          expect(await tokenToWrap.balanceOf(alice)).to.be.bignumber.equal(aliceBalance.sub(aliceAmount));
          expect(await tokenToWrap.balanceOf(wrapper.address)).to.be.bignumber.equal(aliceAmount);
          expect(await wrapper.balanceOf(vault.address)).to.be.bignumber.equal(aliceAmount);

          await vault.withdrawUnwrapped(aliceAmount, {from: alice});

          expect(await vault.balanceOf(alice)).to.be.bignumber.equal(ZERO);
          expect(await tokenToWrap.balanceOf(alice)).to.be.bignumber.equal(aliceBalance);
          expect(await tokenToWrap.balanceOf(wrapper.address)).to.be.bignumber.equal(ZERO);
          expect(await wrapper.balanceOf(vault.address)).to.be.bignumber.equal(ZERO);

        });

        it('should withdraw unwrapped all', async () => {
          await controller.setConverter(tokenToWrap.address, wrapper.address, wrapConverter.address, {from: governance});
          await controller.setConverter(wrapper.address, tokenToWrap.address, unwrapConverter.address, {from: governance});
          const aliceBalance = await tokenToWrap.balanceOf(alice);
          await tokenToWrap.approve(vault.address, aliceBalance, {from: alice});
          await vault.depositAllUnwrapped({from: alice});

          expect(await vault.balanceOf(alice)).to.be.bignumber.equal(aliceBalance);
          expect(await tokenToWrap.balanceOf(alice)).to.be.bignumber.equal(ZERO);
          expect(await tokenToWrap.balanceOf(wrapper.address)).to.be.bignumber.equal(aliceBalance);
          expect(await wrapper.balanceOf(vault.address)).to.be.bignumber.equal(aliceBalance);

          await vault.withdrawAllUnwrapped({from: alice});

          expect(await vault.balanceOf(alice)).to.be.bignumber.equal(ZERO);
          expect(await tokenToWrap.balanceOf(alice)).to.be.bignumber.equal(aliceBalance);
          expect(await tokenToWrap.balanceOf(wrapper.address)).to.be.bignumber.equal(ZERO);
          expect(await wrapper.balanceOf(vault.address)).to.be.bignumber.equal(ZERO);

        });

      });
    }

    it('should set min', async () => {
      await vault.setMin(testMin, {from: governance});
      expect(await vault.min()).to.be.bignumber.equal(testMin);
      await expectRevert(vault.setMin(testMin, {from: governance}), '!new');
      await expectRevert(vault.setMin(testMin, {from: miris}), '!governance');
    });

    it('should set controller', async () => {
      await vault.setController(ZERO_ADDRESS, {from: governance});
      expect(await vault.controller()).to.be.bignumber.equal(ZERO_ADDRESS);
      await expectRevert(vault.setController(ZERO_ADDRESS, {from: governance}), '!new');
      await expectRevert(vault.setController(ZERO_ADDRESS, {from: miris}), '!governance');
    });

    it('should calculate balance correctly', async () => {
      const mockedRevenueTokenBalance = ether('10');

      const revenueTokenERC20 = await IERC20.at(revenueToken.address);

      // prepare calldata
      const balanceOfCalldata = revenueTokenERC20.contract
        .methods.balanceOf(vault.address).encodeABI();

      // mock eurxb balance of this
      await mock.givenCalldataReturnUint(balanceOfCalldata,
        mockedRevenueTokenBalance);

      const strategyAddress = await controller.strategies(
        revenueToken.address, {from: governance}
      );
      expect(strategyAddress).to.be.equal(strategy.address);

      const strategyContract = await IStrategy.at(strategyAddress);
      const strategyContractBalanceOf = await strategyContract.balanceOf(
        {from: governance}
      );

      const revenueTokenBalance = await revenueTokenERC20.balanceOf(
        vault.address, {from: governance}
      );

      const validSum = revenueTokenBalance.add(strategyContractBalanceOf);
      const actualSum = await vault.balance({from: governance});

      expect(actualSum).to.be.bignumber.equal(validSum);
    });

    it('should calculate available balance', async () => {
      const mockedRevenueTokenBalance = ether('10');
      const revenueTokenERC20 = await IERC20.at(revenueToken.address);
      const balanceOfCalldata = revenueTokenERC20.contract
        .methods.balanceOf(vault.address).encodeABI();
      await mock.givenCalldataReturnUint(balanceOfCalldata,
        mockedRevenueTokenBalance);
      const min = await vault.min();
      const max = await vault.max();
      const revenueTokenBalance = await revenueTokenERC20.balanceOf(vault.address);
      const valid = revenueTokenBalance.mul(min).div(max);
      const actual = await vault.available();
      expect(actual).to.be.bignumber.equal(valid);
    });

    it('should get vault token address', async () => {
      expect(await vault.token()).to.be.equal(revenueToken.address);
    });

    it('should get controller', async () => {
      expect(await vault.controller()).to.be.equal(controller.address);
    });

    it('should get price per full share', async () => {
      const mockedAmount = ether('10');

      let revenueTokenERC20 = await IERC20.at(revenueToken.address);

      const transferFromCalldata = revenueTokenERC20.contract
        .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
      const balanceOfVaultCalldata = revenueTokenERC20.contract
          .methods.balanceOf(vault.address).encodeABI();

      await mock.givenCalldataReturnBool(transferFromCalldata,
        true);
      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        mockedAmount);

      if(isInstitutional) {
        await vault.allowInvestor(miris, {from: governance});
      }
      await vault.deposit(mockedAmount, {from: miris});

      const balance = await vault.balance();
      const totalSupply = await vault.totalSupply();
      const validPrice = balance.mul(CONVERSION_WEI_CONSTANT).div(totalSupply);
      const actualPrice = await vault.getPricePerFullShare();
      expect(actualPrice).to.be.bignumber.equal(validPrice);
    });

    it('should deposit correctly', async () => {

      const mockedAmount = ether('10');

      if(isInstitutional) {
        await expectRevert(vault.deposit(mockedAmount, {from: miris}), "!investor");
        await vault.allowInvestor(miris, {from: governance});
      }

      const revenueTokenERC20 = await IERC20.at(revenueToken.address);

      const transferFromMirisCalldata = revenueTokenERC20.contract
        .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
      const transferFromGovernanceCalldata = revenueTokenERC20.contract
        .methods.transferFrom(governance, vault.address, mockedAmount).encodeABI();

      const balanceOfVaultCalldata = revenueTokenERC20.contract
        .methods.balanceOf(vault.address).encodeABI();

      const balanceOfMirisCalldata = revenueTokenERC20.contract
        .methods.balanceOf(miris).encodeABI();
      const balanceOfGovernanceCalldata = revenueTokenERC20.contract
        .methods.balanceOf(governance).encodeABI();


      await mock.givenCalldataReturnBool(transferFromMirisCalldata,
        true);
      await mock.givenCalldataReturnBool(transferFromGovernanceCalldata,
        true);

      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        mockedAmount);

      await mock.givenCalldataReturnUint(balanceOfMirisCalldata,
        mockedAmount);
      await mock.givenCalldataReturnUint(balanceOfGovernanceCalldata,
        mockedAmount);

      if(isInstitutional) {
        await vault.allowInvestor(miris, {from: governance});
      }
      await vault.deposit(mockedAmount, {from: miris});

      let balance = await vault.balance();
      let totalSupply = await vault.totalSupply();

      expect(balance).to.be.bignumber.equal(mockedAmount);
      expect(totalSupply).to.be.bignumber.equal(mockedAmount);
      expect(await vault.balanceOf(miris)).to.be.bignumber.equal(mockedAmount);

      if(isInstitutional) {
        await vault.allowInvestor(governance, {from: governance});
      }
      await vault.deposit(mockedAmount, {from: governance});

      balance = await vault.balance();
      totalSupply = await vault.totalSupply();

      const multiplier = new BN('2');
      expect(balance).to.be.bignumber.equal(mockedAmount);
      expect(totalSupply).to.be.bignumber.equal(mockedAmount.mul(multiplier));
      expect(await vault.balanceOf(governance)).to.be.bignumber.equal(mockedAmount);
    });

    it('should deposit all correctly', async () => {
      const mockedAmount = ether('10');

      if(isInstitutional) {
        await expectRevert(vault.depositAll({from: miris}), "!investor");
        await vault.allowInvestor(miris, {from: governance});
      }

      const revenueTokenERC20 = await IERC20.at(revenueToken.address);

      const transferFromCalldata = revenueTokenERC20.contract
        .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
      const balanceOfVaultCalldata = revenueTokenERC20.contract
        .methods.balanceOf(vault.address).encodeABI();
      const balanceOfMirisCalldata = revenueTokenERC20.contract
        .methods.balanceOf(miris).encodeABI();

      await mock.givenCalldataReturnBool(transferFromCalldata,
        true);
      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        mockedAmount);
      await mock.givenCalldataReturnUint(balanceOfMirisCalldata,
        mockedAmount);

      if(isInstitutional) {
        await vault.allowInvestor(miris, {from: governance});
      }

      await vault.depositAll({from: miris});
      const actualVaultTokens = await vault.balanceOf(miris);
      expect(actualVaultTokens).to.be.bignumber.equal(mockedAmount);
    });

    const withdrawsTestWithEqualAmounts = async (isTestingAll) => {
      const mockedAmount = ether('10');
      const revenueTokenERC20 = await IERC20.at(revenueToken.address);

      const transferFromCalldata = revenueTokenERC20.contract
        .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
      const balanceOfVaultCalldata = revenueTokenERC20.contract
          .methods.balanceOf(vault.address).encodeABI();
      const balanceOfMirisCalldata = revenueTokenERC20.contract
          .methods.balanceOf(miris).encodeABI();


      await mock.givenCalldataReturnBool(transferFromCalldata,
        true);
      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        mockedAmount);
      await mock.givenCalldataReturnUint(balanceOfMirisCalldata,
        mockedAmount);

      if(isInstitutional) {
        await vault.allowInvestor(miris, {from: governance});
      }

      await vault.depositAll({from: miris});

      if(isInstitutional) {
        await vault.disallowInvestor(miris, {from: governance});
      }

      const vaultBalance = await vault.balance();
      const vaultTotalSupply = await vault.totalSupply();

      let r = vaultBalance.mul(mockedAmount).div(vaultTotalSupply);

      const transferCalldata = revenueTokenERC20.contract
        .methods.transfer(miris, r).encodeABI();
      await mock.givenCalldataReturnBool(transferCalldata,
        true);

      if (!isTestingAll) {
        if(isInstitutional) {
          await expectRevert(vault.withdraw(mockedAmount, {from: miris}), "!investor");
          await vault.allowInvestor(miris, {from: governance});
        }
        await vault.withdraw(mockedAmount, {from: miris});
      } else {
        if(isInstitutional) {
          await expectRevert(vault.withdrawAll({from: miris}), "!investor");
          await vault.allowInvestor(miris, {from: governance});
        }
        await vault.withdrawAll({from: miris});
      }

      expect(await vault.balanceOf(miris)).to.be.bignumber.equal(ZERO);
    };

    const withdrawsTestWithoutEqualAmounts = async (isTestingAll) => {
      const mockedAmount = ether('10');
      const revenueTokenERC20 = await IERC20.at(revenueToken.address);

      const transferFromCalldata = revenueTokenERC20.contract
        .methods.transferFrom(miris, miris, ZERO).encodeABI();
      const transferCalldata = revenueTokenERC20.contract
        .methods.transfer(miris, ZERO).encodeABI();

      await mock.givenMethodReturnBool(transferFromCalldata,
        true);
      await mock.givenMethodReturnBool(transferCalldata,
        true);

      const balanceOfVaultCalldata = revenueTokenERC20.contract
          .methods.balanceOf(vault.address).encodeABI();
      const balanceOfMirisCalldata = revenueTokenERC20.contract
          .methods.balanceOf(miris).encodeABI();
      const revenueTokenStrategyBalanceCalldata = revenueTokenERC20.contract
        .methods.balanceOf(strategy.address).encodeABI();


      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        mockedAmount);
      await mock.givenCalldataReturnUint(balanceOfMirisCalldata,
        mockedAmount);

      if(isInstitutional) {
        await vault.allowInvestor(miris, {from: governance});
      }

      await vault.depositAll({from: miris});

      if(isInstitutional) {
        await vault.disallowInvestor(miris, {from: governance});
      }

      const difference = ether('1');

      const vaultBalance = await vault.balance();
      const vaultTotalSupply = await vault.totalSupply();
      let r = vaultBalance.mul(mockedAmount).div(vaultTotalSupply);

      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        r.sub(difference));

      await mock.givenCalldataReturnUint(revenueTokenStrategyBalanceCalldata,
        difference);

      if (!isTestingAll) {
        if(isInstitutional) {
          await expectRevert(vault.withdraw(mockedAmount, {from: miris}), "!investor");
          await vault.allowInvestor(miris, {from: governance});
        }
        await vault.withdraw(mockedAmount, {from: miris});
      } else {
        if(isInstitutional) {
          await expectRevert(vault.withdrawAll({from: miris}), "!investor");
          await vault.allowInvestor(miris, {from: governance});
        }
        await vault.withdrawAll({from: miris});
      }

      expect(await vault.balanceOf(miris)).to.be.bignumber.equal(ZERO);
    };

    it('should withdraw correctly when revenue token amount is equal to vault token amount', async () => {
      await withdrawsTestWithEqualAmounts(false);
    });

    it('should withdraw correctly when revenue token amount is not equal to vault token amount', async () => {
      await withdrawsTestWithoutEqualAmounts(false);
    });

    it('should withdraw all correctly when revenue token amount is not equal to vault token amount', async () => {
      await withdrawsTestWithoutEqualAmounts(true);
    });

    it('should withdraw all correctly when revenue token amount is equal to vault token amount', async () => {
      await withdrawsTestWithEqualAmounts(true);
    });

    const earnTests = async (withConverter) => {
      const revenueTokenERC20 = await IERC20.at(revenueToken.address);

      const transferCalldata = revenueTokenERC20.contract
        .methods.transfer(miris, ZERO).encodeABI();
      await mock.givenMethodReturnBool(transferCalldata,
        true);

      const mockedRevenueTokenBalance = ether('10');
      const balanceOfCalldata = revenueTokenERC20.contract
        .methods.balanceOf(vault.address).encodeABI();
      await mock.givenCalldataReturnUint(balanceOfCalldata,
        mockedRevenueTokenBalance);
      const available = await vault.available();
      await vault.earn();
    };

    it('should earn correctly without converter', async () => {
      await earnTests(false);
    });

    it('should earn correctly with converter', async () => {
      await earnTests(true);
    });
  }
};

module.exports = { vaultTestSuite };
