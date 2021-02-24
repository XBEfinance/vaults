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
const { ZERO_ADDRESS } = constants;

const { ZERO, CONVERSION_WEI_CONSTANT } = require('../utils/common');
const { vaultInfrastructureRedeploy } = require('../utils/vault_infrastructure_redeploy');

const IERC20 = artifacts.require("IERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');

const MockContract = artifacts.require("MockContract");

const testsWithProxy = (useTokenProxy) => {
  return (accounts) => {

    const governance = accounts[0];
    const miris = accounts[1];
    const strategist = accounts[2];

    const testMin = new BN('9600');

    var revenueToken;
    var controller;
    var strategy;
    var vault;
    var mock;
    var cloneFactory;

    beforeEach(async () => {
      if (useTokenProxy) {
        [
          mock,
          controller,
          strategy,
          vault,
          revenueToken,
          cloneFactory
        ] = await vaultInfrastructureRedeploy(
          governance,
          strategist,
          true
        );
      } else {
        [
          mock,
          controller,
          strategy,
          vault,
          revenueToken
        ] = await vaultInfrastructureRedeploy(
          governance,
          strategist,
          false
        );
      }
    });

    if (useTokenProxy) {
      it('should clone token properly', async () => {

        const mockedSum = ether('10');
        const newMock = await MockToken.new("Mock Token", "MT", mockedSum);

        const salt = web3.utils.utf8ToHex('some salt');
        const miniCloneAddress = await cloneFactory.predictCloneAddress(newMock.address, salt);
        const receipt = await cloneFactory.clone(newMock.address, salt);
        expectEvent(receipt, "Cloned", {
          _clone: miniCloneAddress,
          _main: newMock.address
        });
        const miniClone = await MockToken.at(miniCloneAddress);
        await miniClone.mintSender(mockedSum);
        expect(await miniClone.balanceOf(governance)).to.be.bignumber.equal(mockedSum);
      });
    }

    it('should configure successfully', async () => {
      expect(await vault.controller()).to.be.equal(controller.address);
      expect(await vault.governance()).to.be.equal(governance);
      expect(await vault.token()).to.be.equal(revenueToken.address);
      expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
      expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
    });

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

      var revenueTokenERC20 = await IERC20.at(revenueToken.address);

      const transferFromCalldata = revenueTokenERC20.contract
        .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
      const balanceOfVaultCalldata = revenueTokenERC20.contract
          .methods.balanceOf(vault.address).encodeABI();

      await mock.givenCalldataReturnBool(transferFromCalldata,
        true);
      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        mockedAmount);

      await vault.deposit(mockedAmount, {from: miris});

      const balance = await vault.balance();
      const totalSupply = await vault.totalSupply();
      const validPrice = balance.mul(CONVERSION_WEI_CONSTANT).div(totalSupply);
      const actualPrice = await vault.getPricePerFullShare();
      expect(actualPrice).to.be.bignumber.equal(validPrice);
    });

    it('should deposit correctly', async () => {
      const mockedAmount = ether('10');

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

      await vault.deposit(mockedAmount, {from: miris});

      var balance = await vault.balance();
      var totalSupply = await vault.totalSupply();

      expect(balance).to.be.bignumber.equal(mockedAmount);
      expect(totalSupply).to.be.bignumber.equal(mockedAmount);
      expect(await vault.balanceOf(miris)).to.be.bignumber.equal(mockedAmount);

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


      await vault.depositAll({from: miris});


      const vaultBalance = await vault.balance();
      const vaultTotalSupply = await vault.totalSupply();

      var r = vaultBalance.mul(mockedAmount).div(vaultTotalSupply);

      const transferCalldata = revenueTokenERC20.contract
        .methods.transfer(miris, r).encodeABI();
      await mock.givenCalldataReturnBool(transferCalldata,
        true);

      if (!isTestingAll) {
        await vault.withdraw(mockedAmount, {from: miris});
      } else {
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

      await vault.depositAll({from: miris});


      const difference = ether('1');

      const vaultBalance = await vault.balance();
      const vaultTotalSupply = await vault.totalSupply();
      var r = vaultBalance.mul(mockedAmount).div(vaultTotalSupply);

      await mock.givenCalldataReturnUint(balanceOfVaultCalldata,
        r.sub(difference));

      await mock.givenCalldataReturnUint(revenueTokenStrategyBalanceCalldata,
        difference);

      if (!isTestingAll) {
        await vault.withdraw(mockedAmount, {from: miris});
      } else {
        await vault.withdrawAll({from: miris});
      }

      expect(await vault.balanceOf(miris)).to.be.bignumber.equal(ZERO);
    };

    it('should withdraw correctly when revenue token is equal to vault token', async () => {
      await withdrawsTestWithEqualAmounts(false);
    });

    it('should withdraw correctly when revenue token is not equal to vault token', async () => {
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
      await expectRevert(vault.earn(), "Not implemented");
    };

    it('should earn correctly without converter', async () => {
      await earnTests(false);
    });

    it('should earn correctly with converter', async () => {
      await earnTests(true);
    });
  }
};

module.exports = { testsWithProxy };
