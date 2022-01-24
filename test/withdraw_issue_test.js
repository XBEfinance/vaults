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
const artifacts = require('./utils/artifacts');
const environment = require('./utils/environment');
const { people, setPeople } = require('./utils/accounts');

let vault;

contract('Vault Vulnerability Test', (accounts) => {
  setPeople(accounts);

  let owner;
  let alice;
  let bob;

  const mim = "0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3";
  const crv = "0xD533a949740bb3306d119CC777fa900bA034cd52";
  const cvx = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";
  const xbe = "0x5DE7Cc4BcBCa31c473F6D2F27825Cfb09cc0Bb16";
  const spell = "0x090185f2135308BaD17527004364eBcC2D37e5F6";

  beforeEach(async () => {
    owner = await common.waitFor('owner', people);
    alice = await common.waitFor('alice', people);
    bob = await common.waitFor('bob', people);

    vault = await artifacts.HiveVault.at("0x015d5ebeaed4e9c1dbbf5d6d64cdcbe4dffd7cd3");

  });

  it('should perform withdraw vulnerability', async () => {
    const balance = await vault.balanceOf(owner);

    // cvx
    const activeToken = cvx;

    const mimToken = await artifacts.IERC20.at(activeToken);
    const rewardRate = await vault.rewardRates(activeToken);

    const mimBalance = await mimToken.balanceOf(vault.address);
    const rewardsDuration = await vault.rewardsDuration();

    const checkRight = mimBalance.div(rewardsDuration);

    console.log(balance.toString());
    console.log(mimBalance.toString());
    console.log(rewardsDuration.toString());
    console.log("----");
    console.log(rewardRate.toString());
    console.log(checkRight.toString());

    await vault.withdraw(balance, {from: owner});
  });

});
