/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

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

const {
  actorStake, activeActor, deployAndConfigureGovernance
} = require('../utils/governance_redeploy');

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const Controller = artifacts.require("Controller");
const ERC20 = artifacts.require("ERC20");
const IStrategy = artifacts.require("IStrategy");

const MockContract = artifacts.require("MockContract");

contract('InstitutionalEURxbVault', (accounts) => {

  const governance = accounts[0];
  const miris = accounts[1];
  const strategist = accounts[2];

  const stardId = ZERO;
  const initialTotalSupply = ether('15000');
  const treasuryAddress = ZERO_ADDRESS;

  var governanceContract;
  var governanceToken;
  var stakingRewardsToken;
  var revenueToken;
  var controller;
  var strategy;
  var vault;
  var mock;

  const testMin = new BN('9600');

  beforeEach(async () => {
    [ governanceContract, governanceToken, stakingRewardsToken ] = await deployAndConfigureGovernance(
      stardId,
      initialTotalSupply,
      governance
    );

    mock = await MockContract.new();
    controller = await Controller.new();
    strategy = await InstitutionalEURxbStrategy.new();
    vault = await InstitutionalEURxbVault.new();
    revenueToken = await ERC20.at(mock.address);

    await strategy.configure(
      revenueToken.address,
      controller.address,
      {from: governance}
    );

    await controller.configure(
      treasuryAddress,
      strategist,
      {from: governance}
    );

    await vault.configure(
      revenueToken.address,
      controller.address,
      {from: governance}
    );

    await controller.setVault(
      revenueToken.address,
      vault.address,
      {from: governance}
    );

    await controller.setApprovedStrategy(
      revenueToken.address,
      strategy.address,
      true,
      {from: governance}
    );

    await controller.setStrategy(
      revenueToken.address,
      strategy.address,
      {from: governance}
    );

  });

  // it('should configure successfully', async () => {
  //   expect(await vault.controller()).to.be.equal(controller.address);
  //   expect(await vault.governance()).to.be.equal(governance);
  //   expect(await vault.eurxb()).to.be.equal(revenueToken.address);
  //   expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
  //   expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
  // });
  //
  // it('should set min', async () => {
  //   await vault.setMin(testMin, {from: governance});
  //   expect(await vault.min()).to.be.bignumber.equal(testMin);
  //   await expectRevert(vault.setMin(testMin, {from: governance}), '!new');
  //   await expectRevert(vault.setMin(testMin, {from: miris}), '!governance');
  // });
  //
  // it('should set controller', async () => {
  //   await vault.setController(ZERO_ADDRESS, {from: governance});
  //   expect(await vault.controller()).to.be.bignumber.equal(ZERO_ADDRESS);
  //   await expectRevert(vault.setController(ZERO_ADDRESS, {from: governance}), '!new');
  //   await expectRevert(vault.setController(ZERO_ADDRESS, {from: miris}), '!governance');
  // });
  //
  // it('should calculate balance correctly', async () => {
  //   const mockedRevenueTokenBalance = ether('10');
  //
  //   // prepare calldata
  //   const balanceOfCalldata = revenueToken.contract
  //     .methods.balanceOf(vault.address).encodeABI();
  //
  //   // mock eurxb balance of this
  //   await mock.givenCalldataReturnUint(balanceOfCalldata,
  //     mockedRevenueTokenBalance);
  //
  //   const strategyAddress = await controller.strategies(
  //     revenueToken.address, {from: governance}
  //   );
  //   expect(strategyAddress).to.be.equal(strategy.address);
  //
  //   const strategyContract = await IStrategy.at(strategyAddress);
  //   const strategyContractBalanceOf = await strategyContract.balanceOf(
  //     {from: governance}
  //   );
  //
  //   const revenueTokenBalance = await revenueToken.balanceOf(
  //     vault.address, {from: governance}
  //   );
  //
  //   const validSum = revenueTokenBalance.add(strategyContractBalanceOf);
  //   const actualSum = await vault.balance({from: governance});
  //
  //   expect(actualSum).to.be.bignumber.equal(validSum);
  // });
  //
  // it('should calculate available balance', async () => {
  //   const mockedRevenueTokenBalance = ether('10');
  //   // prepare calldata
  //   const balanceOfCalldata = revenueToken.contract
  //     .methods.balanceOf(vault.address).encodeABI();
  //   // mock eurxb balance of this
  //   await mock.givenCalldataReturnUint(balanceOfCalldata,
  //     mockedRevenueTokenBalance);
  //   const min = await vault.min();
  //   const max = await vault.max();
  //   const revenueTokenBalance = await revenueToken.balanceOf(vault.address);
  //   const valid = revenueTokenBalance.mul(min).div(max);
  //   const actual = await vault.available();
  //   expect(actual).to.be.bignumber.equal(valid);
  // });
  //
  // it('should get vault token address', async () => {
  //   expect(await vault.token()).to.be.equal(vault.address);
  // });
  //
  // it('should get eurxb token address', async () => {
  //   expect(await vault.underlying()).to.be.equal(revenueToken.address);
  // });
  //
  // it('should get controller', async () => {
  //   expect(await vault.controller()).to.be.equal(controller.address);
  // });

  it('should get price per full share', async () => {
    const mockedAmount = ether('10');

    const transferFromCalldata = revenueToken.contract
      .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
    const balanceOfVaultCalldata = revenueToken.contract
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

    const transferFromMirisCalldata = revenueToken.contract
      .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
    const transferFromGovernanceCalldata = revenueToken.contract
      .methods.transferFrom(governance, vault.address, mockedAmount).encodeABI();

    const balanceOfVaultCalldata = revenueToken.contract
      .methods.balanceOf(vault.address).encodeABI();

    const balanceOfMirisCalldata = revenueToken.contract
      .methods.balanceOf(miris).encodeABI();
    const balanceOfGovernanceCalldata = revenueToken.contract
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

    const transferFromCalldata = revenueToken.contract
      .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
    const balanceOfVaultCalldata = revenueToken.contract
      .methods.balanceOf(vault.address).encodeABI();
    const balanceOfMirisCalldata = revenueToken.contract
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

    const transferFromCalldata = revenueToken.contract
      .methods.transferFrom(miris, vault.address, mockedAmount).encodeABI();
    const balanceOfVaultCalldata = revenueToken.contract
        .methods.balanceOf(vault.address).encodeABI();
    const balanceOfMirisCalldata = revenueToken.contract
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

    const transferCalldata = revenueToken.contract
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

    const transferFromCalldata = revenueToken.contract
      .methods.transferFrom(miris, miris, ZERO).encodeABI();
    const transferCalldata = revenueToken.contract
      .methods.transfer(miris, ZERO).encodeABI();

    await mock.givenMethodReturnBool(transferFromCalldata,
      true);
    await mock.givenMethodReturnBool(transferCalldata,
      true);

    const balanceOfVaultCalldata = revenueToken.contract
        .methods.balanceOf(vault.address).encodeABI();
    const balanceOfMirisCalldata = revenueToken.contract
        .methods.balanceOf(miris).encodeABI();
    const revenueTokenStrategyBalanceCalldata = revenueToken.contract
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

  it('should earn correctly', async () => {
    
  });

});
