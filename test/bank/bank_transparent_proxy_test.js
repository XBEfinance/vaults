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
const { ZERO, ONE, getMockTokenPrepared, processEventArgs, checkSetter } = require('../utils/common');
const { activeActor, actorStake, deployAndConfigureGovernance } = require(
  '../utils/governance_redeploy'
);

const Bank = artifacts.require("Bank");
const BankProxyAdmin = artifacts.require("BankProxyAdmin");
const BankTransparentProxy = artifacts.require("BankTransparentProxy");
const MockContract = artifacts.require("MockContract");
const Governable = artifacts.require("Governable");
const BankV2Mock = artifacts.require("BankV2Mock");

contract('BankTransparentProxy', (accounts) => {

  const owner = accounts[0];
  const alice = accounts[1];

  var bank;
  var bankProxy;
  var bankProxyAdmin;
  var governable;
  var mock;
  var mockToken;

  beforeEach(async () => {
    mock = await MockContract.new();
    governable = await Governable.at(mock.address);
    mockToken = await getMockTokenPrepared(alice, ether('10'), ether('20'), owner);

    const governanceCalldata = governable.contract.methods.governance().encodeABI();
    await mock.givenCalldataReturnAddress(governanceCalldata, owner);

    bank = await Bank.new();
    const configureCalldata = bank.contract.methods.configure(mockToken.address).encodeABI();
    bankProxyAdmin = await BankProxyAdmin.new(governable.address);
    bankProxy = await BankTransparentProxy.new(bank.address, bankProxyAdmin.address, configureCalldata);
  });

  it('should be configured right', async () => {
    expect(await bankProxyAdmin.getProxyAdmin(bankProxy.address)).to.be.equal(bankProxyAdmin.address);
    expect(await bankProxyAdmin.getProxyImplementation(bankProxy.address)).to.be.equal(bank.address);
    expect(await (await Bank.at(bankProxy.address)).eurxb()).to.be.equal(mockToken.address);
  });

  it('should upgrade bank if called by admin', async () => {
    const newMockToken = await getMockTokenPrepared(alice, ether('10'), ether('20'), owner);
    bank = await BankV2Mock.new();
    const configureCalldata = bank.contract.methods.newConfigure(newMockToken.address, new BN('101')).encodeABI();
    await bankProxyAdmin.upgradeAndCall(bankProxy.address, bank.address, configureCalldata);
    const bankProxyWithBankInterface = await Bank.at(bankProxy.address);
    expect(await bankProxyWithBankInterface.eurxb()).to.be.equal(newMockToken.address);
  });

});
