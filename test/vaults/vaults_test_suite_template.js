/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-vars: 0 */

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
const artifacts = require('../utils/artifacts.js');
const deployment = require('../utils/deployment.js');
const environment = require('../utils/environment.js');
const { people, setPeople } = require('../utils/accounts.js');

const setControllerTest = (vaultName) => async () => {
  await common.checkSetter(
    'setController',
    'controller',
    ZERO_ADDRESS,
    await common.waitFor('owner', people),
    await common.waitFor('alice', people),
    await common.waitFor(vaultName, deployment.deployedContracts, "ct"),
    "Ownable: caller is not the owner",
    expect,
    expectRevert
  );
}

const setRewardsDistributionTest = (vaultName) => async () => {
  await common.checkSetter(
    'setRewardsDistribution',
    'rewardsDistribution',
    ZERO_ADDRESS,
    await common.waitFor('owner', people),
    await common.waitFor('alice', people),
    await common.waitFor(vaultName, deployment.deployedContracts, "rdt"),
    "Ownable: caller is not the owner",
    expect,
    expectRevert
  );
}

const setRewardsDurationTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const mockXBE = await common.waitFor("MockXBE", deployment.deployedContracts);
  const owner = await common.waitFor('owner', people);
  const newDuration = common.days('100');
  await common.checkSetter(
    'setRewardsDuration',
    'rewardsDuration',
    newDuration,
    owner,
    await common.waitFor('alice', people),
    vault,
    "Ownable: caller is not the owner",
    expect,
    expectRevert
  );

  const amount = ether('1');
  await mockXBE.mint(vault.address, amount);
  await vault.notifyRewardAmount(mockXBE.address, amount, { from: owner });

  expectRevert(vault.setRewardsDuration(newDuration, { from: owner }), "!periodFinish");
}

const pauseTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  expectRevert(vault.pause({ from: await common.waitFor('alice', people) }),
    "Ownable: caller is not the owner");
  await vault.pause({ from: await common.waitFor('owner', people) });
  expect(await vault.paused()).to.be.true;
}

const unpauseTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const owner = await common.waitFor('owner', people);
  await vault.pause({ from: owner });
  expectRevert(vault.unpause({ from: await common.waitFor('alice', people) }),
    "Ownable: caller is not the owner");
  await vault.unpause({ from: owner });
  expect(await vault.paused()).to.be.false;
}

const addRewardTokenTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const owner = await common.waitFor('owner', people);
  const alice = await common.waitFor('alice', people);
  const mock = await artifacts.MockContract.new();

  expectRevert(vault.addRewardToken(mock.address, { from: alice }),
    "Ownable: caller is not the owner");

  await vault.addRewardToken(mock.address, { from: owner });
  expect(await vault.isTokenValid(mock.address)).to.be.true;
}

const removeRewardTokenTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const owner = await common.waitFor('owner', people);
  const alice = await common.waitFor('alice', people);
  const mock = await artifacts.MockContract.new();

  expectRevert(vault.removeRewardToken(mock.address, { from: owner }),
    "!remove");

  await vault.addRewardToken(mock.address, { from: owner });

  expectRevert(vault.removeRewardToken(mock.address, { from: alice }),
    "Ownable: caller is not the owner");

  await vault.removeRewardToken(mock.address, { from: owner });
  expect(await vault.isTokenValid(mock.address)).to.be.false;
}

const checkRewardTokenTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const owner = await common.waitFor('owner', people);
  const alice = await common.waitFor('alice', people);
  const mock = await artifacts.MockContract.new();
  await vault.addRewardToken(mock.address, { from: owner });
  expect(await vault.isTokenValid(mock.address)).to.be.true;
}

const getRewardTokenByIndexTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const owner = await common.waitFor('owner', people);
  const alice = await common.waitFor('alice', people);
  const mock = await artifacts.MockContract.new();
  const tokensCount = await vault.getRewardTokensCount();
  await vault.addRewardToken(mock.address, { from: owner });
  expect(await vault.getRewardToken(tokensCount)).to.be.equal(mock.address);
}

const getRewardTokensCountTest = (vaultName, initialTokensCount) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const owner = await common.waitFor('owner', people);
  const alice = await common.waitFor('alice', people);
  const mock = await artifacts.MockContract.new();
  const mock2 = await artifacts.MockContract.new();
  await vault.addRewardToken(mock.address, { from: owner });
  await vault.addRewardToken(mock2.address, { from: owner });
  let currentTokensCount = new BN('2').add(new BN(initialTokensCount));
  expect(await vault.getRewardTokensCount()).to.be.bignumber.equal(currentTokensCount);
  currentTokensCount = currentTokensCount.sub(new BN('1'));
  await vault.removeRewardToken(mock.address, { from: owner });
  expect(await vault.getRewardTokensCount()).to.be.bignumber.equal(currentTokensCount);
}

const lastTimeRewardApplicableTest = (vaultName) => async () => {
  const vault = await common.waitFor(vaultName, deployment.deployedContracts, "rwt");
  const owner = await common.waitFor('owner', people);
  const mockXBE = await common.waitFor("MockXBE", deployment.deployedContracts);

  const amount = ether('1');
  await mockXBE.mint(vault.address, amount);
  await vault.notifyRewardAmount(mockXBE.address, amount, { from: owner });

  const now = await time.latest();
  const periodFinish = await vault.periodFinish();
  expect(await vault.lastTimeRewardApplicable())
    .to.be.bignumber.equal(now);
  await time.increaseTo(common.days('1').add(periodFinish));
  expect(await vault.lastTimeRewardApplicable())
    .to.be.bignumber.equal(periodFinish);
}

const getRewardPerTokenTest = (vaultName) => async () => {

}

const earnedTest = (vaultName) => async () => {

}

const userRewardTest = (vaultName) => async () => {

}

const balanceTest = (vaultName) => async () => {

}

const getPotentialRewardReturns = (vaultName) => async () => {

}

const depositTest = (vaultName) => async () => {

}

const depositForTest = (vaultName) => async () => {

}

const depositAllTest = (vaultName) => async () => {

}

const withdrawTest = (vaultName) => async () => {

}

const withdrawAllTest = (vaultName) => async () => {

}

const withdrawWithCustomizableClaimTest = (vaultName) => async () => {

}

const getRewardTest = (vaultName) => async () => {

}

const notifyRewardAmountTest = (vaultName) => async () => {

}

const earnTest = (vaultName) => async () => {

}

module.exports = {
  setControllerTest,
  setRewardsDistributionTest,
  setRewardsDurationTest,
  pauseTest,
  unpauseTest,
  addRewardTokenTest,
  removeRewardTokenTest,
  checkRewardTokenTest,
  getRewardTokenByIndexTest,
  getRewardTokensCountTest,
  lastTimeRewardApplicableTest,
  getRewardPerTokenTest,
  earnedTest,
  userRewardTest,
  balanceTest,
  // getPotentialRewardReturnsTest,
  depositTest,
  depositForTest,
  depositAllTest,
  withdrawTest,
  withdrawAllTest,
  withdrawWithCustomizableClaimTest,
  getRewardTest,
  notifyRewardAmountTest,
  earnTest
}
