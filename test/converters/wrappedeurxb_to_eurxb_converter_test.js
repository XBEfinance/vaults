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
const { ZERO, ONE, getMockTokenPrepared} = require('../utils/common');

const IStrategy = artifacts.require("IStrategy");
const WrappedEURxbToEURxbConverter = artifacts.require('WrappedEURxbToEURxbConverter');
const TokenWrapper = artifacts.require('TokenWrapper');

const MockContract = artifacts.require("MockContract");

contract('WrappedEURxbToEURxbConverter', (accounts) => {

  const owner = accounts[0];
  const alice = accounts[1];

  var converter;
  var tokenToWrap;
  var wrapper;
  var mock;

  beforeEach(async () => {
    mock = await MockContract.new();
    tokenToWrap = await getMockTokenPrepared(alice, ether('10'), ether('20'), owner);

    converter = await WrappedEURxbToEURxbConverter.new();
    await converter.configure(tokenToWrap.address);

    wrapper = await TokenWrapper.new();
    await wrapper.configure(tokenToWrap.address, alice);
    const MINTER_ROLE = await wrapper.MINTER_ROLE();
    await wrapper.grantRole(MINTER_ROLE, converter.address);
  });

  it('should configure properly', async () => {
    expect(await converter.eurxb()).to.be.equal(tokenToWrap.address);
  });

  it('should convert wrapped eurxb to eurxb', async () => {
    const tokensToUnwrap = ether('5');
    await tokenToWrap.approve(wrapper.address, tokensToUnwrap, {from: alice});

    await wrapper.methods["mint(uint256)"](tokensToUnwrap, {from: alice});

    await wrapper.approve(converter.address, tokensToUnwrap, {from: alice});
    await wrapper.transfer(converter.address, tokensToUnwrap, {from: alice});

    const wantCalldata = (await IStrategy.at(mock.address)).contract
      .methods.want().encodeABI();
    await mock.givenMethodReturnAddress(wantCalldata, wrapper.address);

    const oldBalance = await tokenToWrap.balanceOf(alice);
    await converter.convert(mock.address, {from: alice});
    const newBalance = await tokenToWrap.balanceOf(alice);

    expect(oldBalance.sub(newBalance).abs()).to.be.bignumber.equal(tokensToUnwrap);

  });

});
