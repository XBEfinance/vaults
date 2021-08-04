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
const { ZERO, ONE, getMockTokenPrepared} = require('../utils/old/common');

const IStrategy = contract.fromArtifact("IStrategy");
const WrappedToUnwrappedTokenConverter = contract.fromArtifact('WrappedToUnwrappedTokenConverter');
const TokenWrapper = contract.fromArtifact('TokenWrapper');

const MockContract = contract.fromArtifact("MockContract");

describe('WrappedToUnwrappedTokenConverter', () => {

  const owner = accounts[0];
  const alice = accounts[1];

  var converter;
  var tokenToWrap;
  var wrapper;
  var mock;

  beforeEach(async () => {
    mock = await MockContract.new();
    tokenToWrap = await getMockTokenPrepared(alice, ether('10'), ether('20'), owner);

    converter = await WrappedToUnwrappedTokenConverter.new();
    await converter.configure(tokenToWrap.address);

    wrapper = await TokenWrapper.new(
      "Banked EURxb",
      "bEURxb",
      tokenToWrap.address,
      alice
    );
    const MINTER_ROLE = await wrapper.MINTER_ROLE();
    await wrapper.grantRole(MINTER_ROLE, converter.address);
  });

  it('should configure properly', async () => {
    expect(await converter.token()).to.be.equal(tokenToWrap.address);
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
