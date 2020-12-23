const {
  expectRevert,
  BN,
  ether,
  time,
} = require('@openzeppelin/test-helpers');

const {
  increaseTime,
  currentTimestamp,
  DAY,
  HOUR,
} = require('./utils/common');

const chai = require('chai');
chai.use(require('chai-as-promised'));

const { expect, assert } = chai;

const TetherToken = artifacts.require('TetherToken'); // USDT
const BUSDImplementation = artifacts.require('BUSDImplementation'); // BUSD

const MockToken = artifacts.require('MockToken');

const Router = artifacts.require('Router');
const StakingManager = artifacts.require('StakingManager');

const WETH9 = artifacts.require('WETH9');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Pair = artifacts.require('UniswapV2Pair');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const EURxb = artifacts.require('EURxb');

contract('Router tests for USDT', (accounts) => {
  const owner = accounts[0];
  const recipient = accounts[1];
  const staker = accounts[2];
  const team = accounts[3];

  const newBalancer = accounts[4];
  const newTeam = accounts[5];

  const mockStableToken = accounts[6];

  const uniswapTokens = ['USDT', 'BUSD'];

  let eurxb;
  let xbg;

  let staking;
  let router;

  let timestamp;

  let token = uniswapTokens[0];
  let pairAddress;
  let pair;

  let factory;
  let weth;
  let uniswap_router;

  beforeEach(async () => {
    // configure all the components
    eurxb = await EURxb.new(owner);
    await eurxb.configure(owner);
    await eurxb.mint(owner, ether('1000000'));

    xbg = await MockToken.new('xbg', 'xbg', ether('8000'));

    token = await TetherToken.deployed();
    timestamp = await currentTimestamp();
    timestamp += DAY;

    expect(await eurxb.balanceOf(owner)).to.be.bignumber.equal(ether('1000000'));
    expect(await token.balanceOf(owner)).to.be.bignumber.equal(ether('1000000'));

    // create uniswap router and dependancies
    factory = await UniswapV2Factory.new(owner);
    weth = await WETH9.new();
    uniswap_router = await UniswapV2Router02.new(factory.address, weth.address);
    await factory.createPair(eurxb.address, token.address);

    pairAddress = await factory.allPairs.call(new BN('0'));
    pair = await UniswapV2Pair.at(pairAddress);

    await increaseTime(DAY);

    timestamp = (await currentTimestamp()) + DAY;
    staking = await StakingManager.new(xbg.address, timestamp + DAY);
    await xbg.approve(staking.address, ether('8000'));

    router = await Router.new(
      team, staking.address, timestamp,
      token.address, mockStableToken, mockStableToken, mockStableToken, eurxb.address,
    );

    const lpToken1 = await MockToken.new('LPToken', 'LPT1', ether('400.0'));
    const lpToken2 = await MockToken.new('LPToken', 'LPT2', ether('400.0'));
    const lpToken3 = await MockToken.new('LPToken', 'LPT3', ether('400.0'));

    await router.setUniswapPair(token.address, pairAddress);
    await staking.configure([pairAddress, lpToken1.address, lpToken2.address, lpToken3.address]);

    await router.configure(uniswap_router.address, factory.address);
    await router.setUniswapPair(token.address, pairAddress);
  });

  const printRatios = async function () {
    const { tokenRes, eurRes } = await router.getUniswapReservesRatio(token.address);
    console.log('ratio = ', tokenRes.toString(), '/', eurRes.toString());
  };

  it('initial uniswap reserves', async () => {
    const { tokenRes, eurRes } = await router.getUniswapReservesRatio(token.address);
    assert.equal(tokenRes, '27');
    assert.equal(eurRes, '23');
  });

  it('initial uniswap addLiquidity for pair USDT/EURxb in detail', async () => {
    await increaseTime(DAY);

    await eurxb.transfer(router.address, ether('100'));
    // owner allows router to spend their money
    await token.approve(router.address, ether('100'));

    expect(await eurxb.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('0'));
    expect(await token.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('0'));
    expect(await token.balanceOf(team)).to.be.bignumber.equal(new BN('0'));
    expect(await token.balanceOf(team)).to.be.bignumber.equal(new BN('0'));

    await router.addLiquidity(token.address, ether('100'));

    {
      const { tokenRes, eurRes } = await router.getUniswapReservesRatio(token.address);
      expect(tokenRes).to.be.bignumber.equal(new BN('50000000000000000000'));
      expect(eurRes).to.be.bignumber.equal(new BN('42592592592592592592'));
    }

    expect(await token.balanceOf(owner)).to.be.bignumber.equal(new BN('999900000000000000000000'));
    expect(await eurxb.balanceOf(router.address)).to.be.bignumber.equal(new BN('57407407407407407408'));
    expect(await eurxb.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('42592592592592592592'));
    expect(await token.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('50000000000000000000'));
    expect(await xbg.balanceOf(owner)).to.be.bignumber.equal(new BN('0'));
    expect(await token.balanceOf(team)).to.be.bignumber.equal(new BN('50000000000000000000'));

    await increaseTime(8*DAY);
    await staking.claimReward(owner);
    // not sure about this value
    expect(await xbg.balanceOf(owner)).to.be.bignumber.equal(new BN('1333400000000000000000'));
  });

  // it('consecutive uniswap addLiquidity for pair USDT/EURxb success', async () => {
  //   await increaseTime(DAY);
  //
  //   await eurxb.transfer(router.address, ether('200'));
  //   await token.approve(router.address, ether('100'));
  //
  //   await router.addLiquidity(token.address, ether('100'));
  //
  //   await increaseTime(8*DAY);
  //
  //   await router.addLiquidity(token.address, ether('100'));
  //
  //   printRatios();
  //
  //   // expect(await eurxb.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('0'));
  //   // expect(await token.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('0'));
  //   // expect(await token.balanceOf(team)).to.be.bignumber.equal(new BN('0'));
  //   // expect(await token.balanceOf(team)).to.be.bignumber.equal(new BN('0'));
  //
  //   console.log('owner balance', (await token.balanceOf(owner)).toString());
  //   console.log('eurxb router balance', (await eurxb.balanceOf(router.address)).toString());
  //   console.log('eurxb pair blaance', (await eurxb.balanceOf(pairAddress)).toString());
  //   console.log('token pair balance', (await token.balanceOf(pairAddress)).toString());
  //   console.log('token team balance', (await token.balanceOf(team)).toString());
  //
  //   await increaseTime(8*DAY);
  //   staking.claimReward();
  //   console.log('xbg new', await xbg.balanceOf(owner));
  //
  //   // {
  //   //   const { tokenRes, eurRes } = await router.getUniswapReservesRatio(token.address);
  //   //   expect(tokenRes).to.be.bignumber.equal(new BN('50000000000000000000'));
  //   //   expect(eurRes).to.be.bignumber.equal(new BN('42592592592592592592'));
  //   // }
  //
  //   // expect(await token.balanceOf(owner)).to.be.bignumber.equal(new BN('999900000000000000000000'));
  //   // expect(await eurxb.balanceOf(router.address)).to.be.bignumber.equal(new BN('57407407407407407408'));
  //   // expect(await eurxb.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('42592592592592592592'));
  //   // expect(await token.balanceOf(pairAddress)).to.be.bignumber.equal(new BN('50000000000000000000'));
  //   // expect(await xbg.balanceOf(owner)).to.be.bignumber.equal(new BN('0'));
  //   // expect(await token.balanceOf(team)).to.be.bignumber.equal(new BN('50000000000000000000'));
  //
  //   await increaseTime(8*DAY);
  //   await staking.claimReward(owner);
  //   // not sure about this value
  //   expect(await xbg.balanceOf(owner)).to.be.bignumber.equal(new BN('1333400000000000000000'));
  // });
});
