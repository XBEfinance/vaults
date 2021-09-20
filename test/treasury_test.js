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

const common = require('./utils/common.js');
const utilsConstants = require('./utils/constants.js');
const environment = require('./utils/environment.js');
const deployment = require('./utils/deployment.js');
const artifacts = require('./utils/artifacts.js');
const { people, setPeople } = require('./utils/accounts.js');

let mockXBE;
let treasury;
let votingStakingRewards;

let mock;
let mockedOtherToken;

let owner;
let alice;
const amount = ether('1');


const redeploy = async () => {
  owner = await common.waitFor("owner", people);
  mock = await deployment.MockContract();
  mockedOtherToken = await deployment.MockContract();
  [
    mockXBE,
    treasury,
    votingStakingRewards
  ] = await environment.getGroup(
    [
      'MockXBE',
      'Treasury',
      'VotingStakingRewards'
    ],
    (key) => true,
    true,
    {
      "VotingStakingRewards": {
        4: ZERO_ADDRESS,
        5: ZERO_ADDRESS,
        8: [ ZERO_ADDRESS ],
      },
      "Treasury": {
        3: mock.address,
      },
    }
  );
  await treasury.addTokenToConvert(mockedOtherToken.address, { from: owner });
}

const sendRewardToTreasury = async (_amount) => {
  const _owner = await common.waitFor('owner', people);
  await mockXBE.approve(
    treasury.address,
    _amount,
    { from: _owner }
  );
  await mockXBE.transfer(
    treasury.address,
    _amount,
    { from: _owner }
  );
  await treasury.toVoters();
  return _owner;
}

contract('Treasury', (accounts) => {

  setPeople(accounts);

  describe('configuration and setters', () => {

    beforeEach(async () => {
      await redeploy();
      owner = await sendRewardToTreasury(amount);
      alice = await common.waitFor("alice", people);
    });

    it('should configure properly', async () => {
      expect(await treasury.owner()).to.be.equal(owner);
      expect(await treasury.rewardsDistributionRecipientContract())
        .to.be.equal(votingStakingRewards.address);
      expect(await treasury.rewardsToken()).to.be.equal(mockXBE.address);
      expect(await treasury.uniswapRouter()).to.be.equal(mock.address);
      expect(await treasury.slippageTolerance()).to.be.bignumber.equal(
        utilsConstants.localParams.treasury.slippageTolerance
      );
      expect(await treasury.swapDeadline()).to.be.bignumber.equal(
        utilsConstants.localParams.treasury.swapDeadline
      );
      expect(await treasury.authorized(owner)).to.be.true;
      expect(await treasury.authorized(treasury.address)).to.be.true;
    });

    it('should set rewards token', async () => {
      await common.checkSetter(
        'setRewardsToken',
        'rewardsToken',
        mock.address,
        owner,
        alice,
        treasury,
        "Ownable: caller is not the owner",
        expect,
        expectRevert
      );
    });

    it('should set rewards token', async () => {
      await common.checkSetter(
        'setRewardsToken',
        'rewardsToken',
        mock.address,
        owner,
        alice,
        treasury,
        "Ownable: caller is not the owner",
        expect,
        expectRevert
      );
    });

    it('should set slippage tolerance', async () => {
      await common.checkSetter(
        'setSlippageTolerance',
        'slippageTolerance',
        new BN('500'),
        owner,
        alice,
        treasury,
        "Ownable: caller is not the owner",
        expect,
        expectRevert
      );
      expectRevert(
        treasury.setSlippageTolerance(new BN('10001'), { from: owner }),
        "slippageToleranceTooLarge"
      );
    });

    it('should set rewards distribution recipient contract', async () => {
      await common.checkSetter(
        'setRewardsDistributionRecipientContract',
        'rewardsDistributionRecipientContract',
        mock.address,
        owner,
        alice,
        treasury,
        "Ownable: caller is not the owner",
        expect,
        expectRevert
      );
    });

    it('should set authorized', async () => {
      await treasury.setAuthorized(alice, { from: owner });
      expect(await treasury.authorized(alice)).to.be.true;
    });

    it('should add and remove tokens to convert', async () => {
      expectRevert(treasury.addTokenToConvert(mock.address, { from: alice }), "Ownable: caller is not the owner");
      await treasury.addTokenToConvert(mock.address, { from: owner });
      expectRevert(treasury.addTokenToConvert(mock.address, { from: owner }), "alreadyExists");
      expect(await treasury.isAllowTokenToConvert(mock.address, { from: owner })).to.be.true;
    });

    it('should remove token to convert', async () => {
      await treasury.addTokenToConvert(mock.address, { from: owner });
      expectRevert(treasury.removeTokenToConvert(mock.address, { from: alice }), "Ownable: caller is not the owner");
      await treasury.removeTokenToConvert(mock.address, { from: owner });
      expectRevert(treasury.removeTokenToConvert(mock.address, { from: owner }), "doesntExist");
      expect(await treasury.isAllowTokenToConvert(mock.address, { from: owner })).to.be.false;
    });

    const testCaseForConversionOfTokens = async (action) => {

      expectRevert(treasury.convertToRewardsToken(mock.address, amount, { from: owner }), "tokenIsNotAllowed");

      const expectedReturnCalldata = (await artifacts.IUniswapV2Router02.at(mock.address)).contract.methods
        .getAmountsOut(utilsConstants.utils.ZERO, []).encodeABI();

      const mockedConvertedAmount = amount.mul(new BN('2'));
      await mock.givenMethodReturn(
        expectedReturnCalldata,
        web3.eth.abi.encodeParameters(
          ["uint256[]"],
          [[mockedConvertedAmount, utilsConstants.utils.ZERO, amount]]
        )
      );

      const slippageTolerance = await treasury.slippageTolerance();
      const MAX_BPS = await treasury.MAX_BPS();
      const amountOutMin = mockedConvertedAmount.mul(slippageTolerance).div(MAX_BPS);

      const receipt = await action();
      expectEvent(receipt, "FundsConverted", {
        'from': mockedOtherToken.address,
        'to': mockXBE.address,
        'amountOfTo': amountOutMin
      });
    }

    // it('should execute feeReceiving properly', async () => {
    //   let receipt = await treasury.feeReceiving(mockXBE.address, utilsConstants.utils.ZERO, { from: owner });
    //   expectEvent.notEmitted(receipt, "FundsConverted");
    //
    //   await mockXBE.approve(treasury.address, amount, { from: owner });
    //   await mockXBE.transfer(treasury.address, amount, { from: owner });
    //   await testCaseForConversionOfTokens(
    //     async () => await treasury.feeReceiving(mockedOtherToken.address, amount, { from: owner })
    //   );
    // });

    it('should execute convert tokens properly', async () => {
      await mockXBE.approve(treasury.address, amount, { from: owner });
      await mockXBE.transfer(treasury.address, amount, { from: owner });
      await testCaseForConversionOfTokens(
        async () => await treasury.convertToRewardsToken(mockedOtherToken.address, amount, { from: owner })
      );
    });

    it('should send funds to governance', async () => {
      const oldBalance = await mockXBE.balanceOf(owner);
      await mockXBE.approve(
        treasury.address,
        amount,
        { from: owner }
      );
      await mockXBE.transfer(
        treasury.address,
        amount,
        { from: owner }
      );
      await treasury.toGovernance(mockXBE.address, amount, { from: owner });
      const newBalance = await mockXBE.balanceOf(owner);
      expect(newBalance.sub(oldBalance)).to.be.bignumber.equal(utilsConstants.utils.ZERO);
    });

    it('should send funds to voters', async () => {
      expect(await mockXBE.balanceOf(votingStakingRewards.address)).to.be.bignumber.equal(amount);
    });

  });
});
