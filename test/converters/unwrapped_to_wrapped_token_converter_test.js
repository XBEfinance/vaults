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
const { ZERO, ONE, getMockTokenPrepared } = require('../utils/common');

const IERC20 = contract.fromArtifact("IERC20");
const IStrategy = contract.fromArtifact("IStrategy");
const UnwrappedToWrappedTokenConverter = contract.fromArtifact('UnwrappedToWrappedTokenConverter');
const TokenWrapper = contract.fromArtifact('TokenWrapper');

const MockContract = contract.fromArtifact("MockContract");

describe('UnwrappedToWrappedTokenConverter', () => {

  const owner = accounts[0];
  const alice = accounts[1];

  var converter;
  var tokenToWrap;
  var wrapper;
  var mock;

  beforeEach(async () => {
    mock = await MockContract.new();
    tokenToWrap = await getMockTokenPrepared(alice, ether('10'), ether('20'), owner);

    converter = await UnwrappedToWrappedTokenConverter.new();
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
    expect(await converter.eurxb()).to.be.equal(tokenToWrap.address);
  });

  it('should convert eurxb to wrapped eurxb', async () => {
    const tokensToWrap = ether('5');
    await tokenToWrap.approve(converter.address, tokensToWrap, {from: alice});
    await tokenToWrap.transfer(converter.address, tokensToWrap, {from: alice});

    const wantCalldata = (await IStrategy.at(mock.address)).contract
      .methods.want().encodeABI();
    await mock.givenMethodReturnAddress(wantCalldata, wrapper.address);

    const oldBalance = await wrapper.balanceOf(alice);
    await converter.convert(mock.address, {from: alice});
    const newBalance = await wrapper.balanceOf(alice);

    expect(oldBalance.sub(newBalance).abs()).to.be.bignumber.equal(tokensToWrap);
  });

});
