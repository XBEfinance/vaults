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
const { accounts, contract } = require('@openzeppelin/test-environment');
const { ZERO_ADDRESS } = constants;
const { ZERO, ONE, getMockTokenPrepared, processEventArgs, checkSetter } = require('./utils/common');
const { activeActor, actorStake, deployAndConfigureGovernance } = require(
  './utils/governance_redeploy'
);

const IERC20 = contract.fromArtifact("IERC20");
const IStrategy = contract.fromArtifact("IStrategy");
const MockToken = contract.fromArtifact('MockToken');
const IOneSplitAudit = contract.fromArtifact('IOneSplitAudit');
const TokenWrapper = contract.fromArtifact('TokenWrapper');

const MockContract = contract.fromArtifact("MockContract");

describe('TokenWrapper', () => {

  const owner = accounts[0];
  const alice = accounts[1];
  const fool = accounts[2];

  let tokenToWrap;
  let wrapper;
  let mock;

  let MINTER_ROLE;

  beforeEach(async () => {
    mock = await MockContract.new();
    tokenToWrap = await getMockTokenPrepared(alice, ether('10'), ether('20'), owner);
    wrapper = await TokenWrapper.new("Banked EURxb", "bEURxb", tokenToWrap.address, alice);
    MINTER_ROLE = await wrapper.MINTER_ROLE();
  });

  it('should be configured properly', async () => {
    expect(await wrapper.wrappedToken()).to.be.equal(tokenToWrap.address);
    expect(await wrapper.hasRole(MINTER_ROLE, alice)).to.be.equal(true);
  });

  it('should mint tokens', async () => {
    const tokensToWrap = ether('5');
    await tokenToWrap.approve(wrapper.address, tokensToWrap, {from: alice});
    await tokenToWrap.transfer(wrapper.address, tokensToWrap, {from: alice});
    await wrapper.methods['mint(uint256)'](tokensToWrap, {from: alice});
    expect(await wrapper.balanceOf(alice)).to.be.bignumber.equal(tokensToWrap);
  });

  it('should reject minting if called not by minter role', async () => {
    await expectRevert(wrapper.methods['mint(uint256)'](ZERO, {from: fool}), "!minter");
  });

  it('should burn tokens', async () => {
    const tokensToWrap = ether('5');
    await tokenToWrap.approve(wrapper.address, tokensToWrap, {from: alice});
    await tokenToWrap.transfer(wrapper.address, tokensToWrap, {from: alice});
    await wrapper.methods['mint(uint256)'](tokensToWrap, {from: alice});

    const oldBalance = await tokenToWrap.balanceOf(alice);
    await wrapper.burn(tokensToWrap, {from: alice});
    const newBalance = await tokenToWrap.balanceOf(alice);

    expect(oldBalance.sub(newBalance).abs()).to.be.bignumber.equal(tokensToWrap);
  });

  it('should reject burning if called not by minter role', async () => {
    await expectRevert(wrapper.burn(ZERO, {from: fool}), "!minter");
  });

});
