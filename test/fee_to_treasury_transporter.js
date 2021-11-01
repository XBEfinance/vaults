/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const common = require('./utils/common');
const utilsConstants = require('./utils/constants');
const ZERO = utilsConstants.utils.ZERO;
const artifacts = require('./utils/artifacts');
const environment = require('./utils/environment');
const { people, setPeople } = require('./utils/accounts');

let uniswapRouter;
let rewardsToken;
let mockXBE;
let mockCRV;
let mockCVX;
let feeToTreasuryTransporter;

let owner;
let alice;

contract('FeeToTreasuryTransporter', (accounts) => {
  setPeople(accounts);

  beforeEach(async () => {
    owner = await common.waitFor("owner", people);
    alice = await common.waitFor("alice", people);
    [
      uniswapRouter,
      mockXBE,
      mockCRV,
      mockCVX,
      feeToTreasuryTransporter
    ] = await environment.getGroup(
      [
        'MockContract',
        'MockXBE',
        'MockCRV',
        'MockCVX',
        'FeeToTreasuryTransporter'
      ],
      (_) => true,
      true,
      {
        "FeeToTreasuryTransporter" : {
          1: owner
        }
      }
    );
  });

  it('should set/get rewards token', async () => {
    await common.checkSetter(
      'setRewardsToken',
      'rewardsToken',
      uniswapRouter.address,
      owner,
      alice,
      feeToTreasuryTransporter,
      "Ownable: caller is not the owner",
      expect,
      expectRevert
    );
  });

  it('should add token to convert', async () => {
    await expectRevert(
      feeToTreasuryTransporter.addTokenToConvert(uniswapRouter.address, {from: alice}),
      "Ownable: caller is not the owner",
    );
    await feeToTreasuryTransporter.addTokenToConvert(uniswapRouter.address, {from: owner});
    expect(await feeToTreasuryTransporter.getTokenToConvert(new BN('2'))).to.be.equal(uniswapRouter.address);
    await expectRevert(
      feeToTreasuryTransporter.addTokenToConvert(uniswapRouter.address, {from: owner}),
      "alreadyExists",
    );
  });

  it('should remove token to convert', async () => {
    await expectRevert(
      feeToTreasuryTransporter.removeTokenToConvert(uniswapRouter.address, {from: alice}),
      "Ownable: caller is not the owner",
    );
    await feeToTreasuryTransporter.addTokenToConvert(uniswapRouter.address, {from: owner});
    await feeToTreasuryTransporter.removeTokenToConvert(uniswapRouter.address, {from: owner});
    await expectRevert(
      feeToTreasuryTransporter.removeTokenToConvert(uniswapRouter.address, {from: owner}),
      "doesntExist",
    );
  });

  it('should get length of the tokens to convert', async () => {
    await feeToTreasuryTransporter.addTokenToConvert(alice, {from: owner});
    await feeToTreasuryTransporter.addTokenToConvert(owner, {from: owner});
    expect(await feeToTreasuryTransporter.getTokensToConvertLength()).to.be.bignumber.equal(new BN('4'));
  });

  it('should set/get treasury', async () => {
    await common.checkSetter(
      'setTreasury',
      'treasury',
      uniswapRouter.address,
      owner,
      alice,
      feeToTreasuryTransporter,
      "Ownable: caller is not the owner",
      expect,
      expectRevert
    );
  });

  it('should set/get uniswap router', async () => {
    await common.checkSetter(
      'setUniswapRouter',
      'uniswapRouter',
      uniswapRouter.address,
      owner,
      alice,
      feeToTreasuryTransporter,
      "Ownable: caller is not the owner",
      expect,
      expectRevert
    );
  });

  it('should convert all tokens to XBE and send them to treasury', async () => {

    const uniswapRouterInstance = await artifacts.IUniswapV2Router02.at(uniswapRouter.address);
    const swapExactTokensForTokensCalldata = uniswapRouterInstance.contract.methods.swapExactTokensForTokens(
      ZERO_ADDRESS,
      ZERO,
      [ZERO_ADDRESS, ZERO_ADDRESS],
      ZERO_ADDRESS,
      ZERO
    ).encodeABI();

    const mockedSwappedEther = ether('1');
    const mockedSwappedXBE = ether('2');

    await uniswapRouter.givenMethodReturn(
      swapExactTokensForTokensCalldata,
      web3.eth.abi.encodeParameters(
        ["uint256[]"],
        [[mockedSwappedEther, mockedSwappedXBE]]
      )
    );

    await expectRevert(
      feeToTreasuryTransporter.convertToRewardsToken(
        [ZERO, ZERO, ZERO],
        [ZERO_ADDRESS, ZERO_ADDRESS],
        {from: owner}
      ),
      "invalidLengthOfAmountsOutMin"
    );

    await expectRevert(
      feeToTreasuryTransporter.convertToRewardsToken(
        [ZERO, ZERO],
        [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
        {from: owner}
      ),
      "invalidLengthOfDeadlines"
    );

    const crvAmount = ether('1');
    const cvxAmount = ether('1');

    await mockCRV.transfer(feeToTreasuryTransporter.address, crvAmount, {from: owner});
    await mockCVX.transfer(feeToTreasuryTransporter.address, cvxAmount, {from: owner});

    let receipt = await feeToTreasuryTransporter.convertToRewardsToken(
      [crvAmount, cvxAmount],
      [mockCRV.address, mockCVX.address],
      {from: owner}
    );

    expectEvent(receipt, "FundsConverted");

    expect(await mockCRV.allowance(feeToTreasuryTransporter.address, uniswapRouter.address)).to.be.bignumber.above(ZERO);
    expect(await mockCVX.allowance(feeToTreasuryTransporter.address, uniswapRouter.address)).to.be.bignumber.above(ZERO);

    await mockCRV.transfer(feeToTreasuryTransporter.address, crvAmount, {from: owner});
    await mockCVX.transfer(feeToTreasuryTransporter.address, cvxAmount, {from: owner});

    // coverage notice
    await feeToTreasuryTransporter.convertToRewardsToken(
      [crvAmount, cvxAmount],
      [mockCRV.address, mockCVX.address],
      {from: owner}
    );
  });

});
