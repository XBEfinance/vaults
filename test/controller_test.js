/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  // constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const common = require('./utils/common');
const constants = require('./utils/constants');
const environment = require('./utils/environment');
const { people, setPeople } = require('./utils/accounts');
const IStrategy = artifacts.require('IStrategy');
const Controller = artifacts.require('Controller');
const MockToken = artifacts.require('MockToken');
const MockContract = artifacts.require('MockContract');
const UnwrappedToWrappedTokenConverter =
  artifacts.require('UnwrappedToWrappedTokenConverter');
const IERC20 = artifacts.require('IERC20');
const IConverter = artifacts.require('IConverter');

const { ZERO, ZERO_ADDRESS } = constants.utils;

contract('Controller', (accounts) => {

  setPeople(accounts);

  let revenueToken;
  let controller;
  let strategy;
  let strategyMock;
  let vault;
  let treasury;
  let mock;
  let wrapper;

  beforeEach(async () => {
    // constants.localParams.bonusCampaign.startMintTime = await time.latest();
    [
      mock,
      strategyMock,
      vault,
      revenueToken,
      controller,
      treasury
    ] = await environment.getGroup(
      [
        'MockContract',
        'MockContract',
        'MockContract',
        'MockXBE',
        'MockToken',
        'Controller',
        'Treasury',
      ],
      (key) => [
        'MockContract',
        'MockContract',
        'MockContract',
        'MockToken',
        'Controller',
        'Treasury'
      ].includes(key),
      true,
      {
        "Treasury": {
          1: ZERO_ADDRESS,
        },
      },
    );

    strategy = await IStrategy.at(strategyMock.address);
    await controller
      .setApprovedStrategy(revenueToken.address, strategy.address, { from: people.owner });
    await controller.setStrategy(revenueToken.address, strategy.address, { from: people.owner });
    await controller.setVault(revenueToken.address, vault.address, { from: people.owner });
  });

  it('should configure properly', async () => {
    expect(await controller.strategist()).to.be.equal(people.bob);
    expect(await controller.rewards()).to.be.equal(treasury.address);
  });

  it('should evacuate tokens from controller', async () => {
    const amount = ether('10');
    const toEvacuateByGovernance = ether('5');
    const toEvacuateByStrategist = ether('5');
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), { from: people.alice });
    mockToken.approve(controller.address, amount, { from: people.alice });
    mockToken.transfer(controller.address, amount, { from: people.alice });

    await expectRevert(controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByGovernance,
      { from: people.alice },
    ), '!governance|strategist');

    await controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByGovernance,
      { from: people.owner },
    );
    await controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByStrategist,
      { from: people.bob },
    );
    expect(await mockToken.balanceOf(people.owner)).to.be.bignumber.equals(toEvacuateByGovernance);
    expect(await mockToken.balanceOf(people.bob)).to.be.bignumber.equals(toEvacuateByStrategist);
  });

  it('should evacuate all tokens from strategy', async () => {
    const withdrawCalldata = strategy.contract.methods.withdraw(revenueToken.address).encodeABI();
    await strategyMock.givenCalldataRevertWithMessage(withdrawCalldata, '!want');

    console.log(people.owner);
    await expectRevert(
      controller.inCaseStrategyTokenGetStuck(
        strategy.address,
        revenueToken.address,
        { from: people.owner },
      ),
      '!want',
    );
    const mockedBalance = ether('10');
    const mockToken = await common.getMockTokenPrepared(strategy.address, mockedBalance, ether('123'), people.alice);

    await expectRevert(
      controller.inCaseStrategyTokenGetStuck(
        strategy.address,
        mockToken.address,
        { from: people.alice },
      ),
      '!governance|strategist',
    );

    await controller.inCaseStrategyTokenGetStuck(
      strategy.address,
      mockToken.address,
      { from: people.owner },
    );
    // expect(await mockToken.balanceOf(controller.address)).to.be.bignumber.equal(mockedBalance);

    // mock = await MockContract.new();
    // mockToken = await MockToken.at(mock.address);
    // await expectRevert(
    //   controller.inCaseStrategyTokenGetStuck(
    //     strategy.address,
    //     mockToken.address,
    //     { from: people.owner },
    //   ),
    //   '!transfer',
    // );
  });

  it('should withdraw tokens from strategy', async () => {
    const mockedBalance = ether('10');
    const toWithdraw = ether('5');
    const balanceOfStrategyCalldata = revenueToken.contract
      .methods.balanceOf(strategy.address).encodeABI();
    await mock.givenCalldataReturnUint(balanceOfStrategyCalldata, mockedBalance);

    // await strategy.setController(mock.address, { from: people.owner });

    const vaultsCalldata = controller.contract
      .methods.vaults(revenueToken.address).encodeABI();

    await mock.givenCalldataReturnAddress(vaultsCalldata, ZERO_ADDRESS);

    const invalidVault = await (await Controller.at(mock.address))
      .vaults(revenueToken.address);

    expect(invalidVault).to.be.equal(ZERO_ADDRESS);

    await strategy.setController(controller.address, { from: people.owner });

    const transferCalldata = revenueToken.contract
      .methods.transfer(people.alice, 0).encodeABI();

    await mock.givenMethodReturnBool(transferCalldata, false);

    const converter = await UnwrappedToWrappedTokenConverter.new();
    await converter.configure(revenueToken.address);

    await controller.withdraw(revenueToken.address, toWithdraw);
    // await expectRevert(controller.withdraw(revenueToken.address, toWithdraw),
    //   '!transferVault');
  });

  it('should set one split parts', async () => {
    const oldParts = await controller.parts();
    await expectRevert(controller.setParts(oldParts, { from: people.owner }), '!old');
    const newParts = new BN('10');
    await controller.setParts(newParts, { from: people.owner });
    expect(await controller.parts()).to.be.bignumber.equal(newParts);
  });

  it('should get treasury address', async () => {
    expect(await controller.rewards()).to.be.equal(treasury.address);
  });

  it('should set treasury address', async () => {
    await expectRevert(controller.setTreasury(ZERO_ADDRESS, { from: people.owner }), '!treasury');
    await expectRevert(controller.setTreasury(people.alice, { from: people.owner }), '!contract');
    await expectRevert(controller.setTreasury(await controller.rewards(), { from: people.owner }), '!old');
    const newTreasury = mock.address;
    await controller.setTreasury(newTreasury, { from: people.owner });
    expect(await controller.rewards()).to.be.bignumber.equal(newTreasury);
  });

  it('should set one split address', async () => {
    await expectRevert(controller.setOneSplit(await controller.oneSplit(), { from: people.owner }), '!old');
    const newOneSplit = mock.address;
    await controller.setOneSplit(newOneSplit, { from: people.owner });
    expect(await controller.oneSplit()).to.be.equal(newOneSplit);
  });

  it('should set strategist address', async () => {
    await expectRevert(controller.setStrategist(people.bob, { from: people.owner }), '!old');
    const newStrategist = people.alice;
    await controller.setStrategist(newStrategist, { from: people.owner });
    expect(await controller.strategist()).to.be.equal(newStrategist);
  });

  it('should set vault by token', async () => {
    const mockToken = await common.getMockTokenPrepared(strategy.address, ether('10'), ether('123'), people.alice);
    await expectRevert(controller.setVault(revenueToken.address, vault.address, { from: people.owner }), '!vault 0');
    await controller.setVault(mockToken.address, mock.address, { from: people.owner });
    expect(await controller.vaults(mockToken.address)).to.be.equal(mock.address);
  });

  it('should get vault by token', async () => {
    expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
  });

  it('should set strategy address', async () => {
    await expectRevert(controller.setStrategy(revenueToken.address, mock.address, { from: people.owner }), '!approved');

    const transferCalldata = revenueToken.contract
      .methods.transfer(people.alice, 0).encodeABI();
    const balanceOfCalldata = revenueToken.contract
      .methods.balanceOf(people.alice).encodeABI();
    const mockedBalance = ether('10');

    await mock.givenMethodReturnUint(balanceOfCalldata, mockedBalance);
    await mock.givenMethodReturnBool(transferCalldata, true);

    await controller.setApprovedStrategy(
      revenueToken.address,
      mock.address,
      true,
      { from: people.owner },
    );
    const receipt = await controller.setStrategy(
      revenueToken.address,
      mock.address,
      { from: people.owner },
    );
    expectEvent(receipt, 'WithdrawToVaultAll', {
      _token: revenueToken.address,
    });
    expect(await controller.strategies(revenueToken.address)).to.be.equal(mock.address);
  });

  it('should get strategy by token', async () => {
    expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
  });

  it('should set converter address', async () => {
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), { from: people.alice });
    await controller.setConverter(
      revenueToken.address,
      mockToken.address,
      mock.address,
      { from: people.owner },
    );
    expect(
      await controller.converters(revenueToken.address, mockToken.address, { from: people.owner }),
    ).to.be.equal(mock.address);
  });

  it('should approve strategy address', async () => {
    await controller.setApprovedStrategy(
      revenueToken.address,
      mock.address,
      true,
      { from: people.owner },
    );
    expect(
      await controller.approvedStrategies(
        revenueToken.address,
        mock.address,
        { from: people.owner },
      ),
    ).to.be.equal(true);
  });

  it('should get approved strategy address', async () => {
    expect(
      await controller.approvedStrategies(revenueToken.address, mock.address),
    ).to.be.equal(false);
  });

  it('should send tokens to the strategy and earn', async () => {
    const mockedBalance = ether('10');
    const sumToEarn = ether('1');
    const sumToEarnInRevenueToken = ether('2');

    const mockToken = await common.getMockTokenPrepared(strategy.address, mockedBalance, ether('123'), people.alice);
    /// /
    await controller.setApprovedStrategy(
      mockToken.address,
      strategy.address,
      true,
      { from: people.owner },
    );
    await controller.setStrategy(mockToken.address, strategy.address, { from: people.owner });

    let strategyWantCallData = await strategy.contract.methods.want().encodeABI();
    await strategyMock.givenMethodReturnAddress(strategyWantCallData, mock.address);

    await expectRevert(controller.earn(mockToken.address, sumToEarn, { from: people.owner }), '!converter');

    await strategyMock.reset();
    /// /

    ///
    const secondMock = await MockContract.new();

    const secondMockWantCallData = await strategy.contract.methods.want().encodeABI();
    await strategyMock.givenMethodReturnAddress(secondMockWantCallData, mock.address);

    console.log(
      (await strategy.want()).toString(),
    );

    await controller.setApprovedStrategy(
      secondMock.address,
      strategy.address,
      true,
      { from: people.owner },
    );
    await controller.setStrategy(secondMock.address, strategy.address, { from: people.owner });

    await controller.setConverter(
      secondMock.address,
      mock.address,
      mock.address,
      { from: people.owner },
    );

    const transferSecondMockCalldata = (await IERC20.at(secondMock.address)).contract
      .methods.transfer(secondMock.address, 0).encodeABI();
    await secondMock.givenMethodReturnBool(transferSecondMockCalldata, false);

    await expectRevert(controller.earn(secondMock.address, sumToEarn, { from: people.alice }), '!transferConverterToken');

    const converterCalldata = (await IConverter.at(mock.address)).contract
      .methods.convert(strategy.address).encodeABI();

    await mock.givenCalldataReturnUint(converterCalldata, sumToEarnInRevenueToken);

    const transferCalldata = (await IERC20.at(mock.address)).contract
      .methods.transfer(ZERO_ADDRESS, ZERO).encodeABI();

    await secondMock.givenMethodReturnBool(transferSecondMockCalldata, true);

    await mock.givenMethodReturnBool(transferCalldata, false);
    await expectRevert(controller.earn(secondMock.address, sumToEarn, { from: people.alice }), '!transferStrategyWant');

    await mock.givenMethodReturnBool(transferCalldata, true);

    let receipt = await controller.earn(secondMock.address, sumToEarn, { from: people.alice });
    await expectEvent(receipt, 'Earn');

    await strategyMock.reset();
    /// /

    ///
    strategyWantCallData = await strategy.contract.methods.want().encodeABI();
    await strategyMock.givenMethodReturnAddress(strategyWantCallData, mock.address);

    await controller.setApprovedStrategy(
      mock.address,
      strategy.address,
      true,
      { from: people.owner },
    );
    await controller.setStrategy(mock.address, strategy.address, { from: people.owner });

    const vaultTransferCalldata = revenueToken.contract
      .methods.transfer(vault.address, 0).encodeABI();
    await mock.givenMethodReturnBool(vaultTransferCalldata, true);
    let transferMockCalldata = revenueToken.contract
      .methods.transfer(mock.address, 0).encodeABI();
    await mock.givenMethodReturnBool(transferMockCalldata, false);
    await expectRevert(controller.earn(mock.address, sumToEarnInRevenueToken), '!transferStrategyToken');
    ///

    transferMockCalldata = revenueToken.contract
      .methods.transfer(mock.address, 0).encodeABI();
    await mock.givenMethodReturnBool(transferMockCalldata, true);
    receipt = await controller.earn(mock.address, sumToEarnInRevenueToken);
    await expectEvent(receipt, 'Earn', {
      _token: mock.address,
      _amount: sumToEarnInRevenueToken,
    });
  });
});
