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

const common = require('../utils/common.js');
const utilsConstants = require('../utils/constants.js');
const environment = require('../utils/environment.js');
const deployment = require('../utils/deployment.js');
const artifacts = require('../utils/artifacts.js');
const { people, setPeople } = require('../utils/accounts.js');

let mockXBE;
let mockLpSushi;
let sushiVault;
let sushiStrategy;
let controller;
let simpleXBEInflation;

let mockedVotingStakingRewards;
let mockedTreasury;

let owner;
let alice;
const amount = ether('1');


const redeploy = async () => {
  owner = await common.waitFor("owner", people);
  mockedVotingStakingRewards = await artifacts.MockContract.new();
  mockedTreasury = await deployment.MockContract();
  [
    mockXBE,
    mockLpSushi,
    sushiStrategy,
    sushiVault,
    controller,
    simpleXBEInflation
  ] = await environment.getGroup(
    [
      'MockXBE',
      'MockLPSushi',
      'SushiStrategy',
      'SushiVault',
      'Controller',
      'SimpleXBEInflation'
    ],
    (key) => true,
    true,
    {
      'Controller': {
        0: mockedTreasury.address
      },
      'SushiVault': {
        5: mockedVotingStakingRewards.address
      }
    }
  );
}

contract('SushiStrategy', (accounts) => {

  setPeople(accounts);

  describe('configuration and setters', () => {

    beforeEach(async () => {
      await redeploy();
      owner = await common.waitFor("owner", people);
      alice = await common.waitFor("alice", people);
    });

    it('should configure properly', async () => {
      expect(await sushiStrategy.want()).to.be.equal(mockLpSushi.address);
      expect(await sushiStrategy.controller()).to.be.equal(controller.address);
      expect(await sushiStrategy.owner()).to.be.equal(owner);
      expect((await sushiStrategy.poolSettings())['xbeToken']).to.be.equal(mockXBE.address);
    });

    it('should set controller', async () => {
      await common.checkSetter(
        'setController',
        'controller',
        ZERO_ADDRESS,
        await common.waitFor("owner", people),
        await common.waitFor("alice", people),
        sushiStrategy,
        "Ownable: caller is not the owner",
        expect,
        expectRevert
      );
    });

    it('should set want', async () => {
      await common.checkSetter(
        'setWant',
        'want',
        ZERO_ADDRESS,
        await common.waitFor("owner", people),
        await common.waitFor("alice", people),
        sushiStrategy,
        "Ownable: caller is not the owner",
        expect,
        expectRevert
      );
    });

    it('should withdraw tokens from strategy to controller', async () => {
      expectRevert(sushiStrategy.methods['withdraw(address)'](ZERO_ADDRESS), "!controller");
      expectRevert(sushiStrategy.methods['withdraw(address)'](mockLpSushi.address), "!want");
      await sushiStrategy.setController(owner, { from: owner });
      await mockXBE.mint(sushiStrategy.address, amount);
      const receipt = await sushiStrategy.methods['withdraw(address)'](mockXBE.address, { from: owner });
      expectEvent(receipt, 'Withdrawn', {
        '_token': mockXBE.address,
        '_amount': amount,
        '_to': owner
      });
    });

    it('should withdraw want token from strategy to vault', async () => {
      expectRevert(
        sushiStrategy.methods['withdraw(uint256)'](utilsConstants.utils.ZERO),
        "!controller|vault"
      );
      const mockedWant = await environment.MockToken();
      const mock = await deployment.MockContract();

      await sushiStrategy.setWant(mockedWant.address, { from: owner });
      await sushiStrategy.setController(mock.address, { from: owner });

      await mockedWant.mint(sushiStrategy.address, amount);

      const vaultsCalldata = (await artifacts.IController.at(mock.address)).contract.methods
        .vaults(mockLpSushi.address).encodeABI();
      await mock.givenMethodReturnAddress(vaultsCalldata, owner);

      const receipt = await sushiStrategy.methods['withdraw(uint256)'](amount, { from: owner });
      expectEvent(receipt, 'Withdrawn', {
        '_token': mockedWant.address,
        '_amount': amount,
        '_to': owner
      });

    });

    it('should claim rewards from strategy', async () => {
      expectRevert(
        sushiStrategy.methods['withdraw(uint256)'](utilsConstants.utils.ZERO),
        "!controller|vault"
      );

      let receipt = await controller.claim(mockLpSushi.address, mockXBE.address, { from: owner });
      expectEvent.notEmitted(receipt, "ClaimedReward");

      await mockXBE.mint(sushiStrategy.address, amount);
      console.log((await mockXBE.balanceOf(sushiStrategy.address)).toString());
      await controller.claim(mockLpSushi.address, mockXBE.address, { from: owner });
      expect(await mockXBE.balanceOf(sushiVault.address)).to.be.bignumber.equal(amount);
    });

  });
});
