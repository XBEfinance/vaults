const {
  expect,
  assert,
} = require('chai');
const {
  expectEvent,
  expectRevert,
  ether,
  BN,
  time,
} = require('@openzeppelin/test-helpers');
const { vaultInfrastructureRedeployWithRevenueToken } = require('../utils/vault_infrastructure_redeploy');
const {
  takeSnapshot,
  revertToSnapShot,
  increaseTime,
  lastBlockTimestamp,
  DAY,
  YEAR,
  MONTH,
} = require('../utils/common');

const BankV2 = artifacts.require('BankV2');
const EURxb = artifacts.require('EURxb');
const DDP = artifacts.require('DDP');
const BondToken = artifacts.require('BondToken');
const SecurityAssetToken = artifacts.require('SecurityAssetToken');
const AllowList = artifacts.require('AllowList');
const ConsumerEURxbStrategy = artifacts.require('ConsumerEURxbStrategy');
const ConsumerEURxbVault = artifacts.require('ConsumerEURxbVault');
const MultiSignature = artifacts.require('MultiSignature');

contract('BankV2', (accounts) => {
  const owner = accounts[0];
  const minter = accounts[1];
  const client = accounts[2];
  const alice = accounts[3];
  const bob = accounts[4];

  beforeEach(async () => {
    // timestamp = await lastBlockTimestamp();
    this.ETHER_100 = ether('100');
    this.ETHER_0 = web3.utils.toWei('0', 'ether');
    this.DATE_SHIFT = new BN('10000');
    this.TOKEN_1 = new BN('1');
    this.TOKEN_2 = new BN('2');
    this.threshold = new BN('6');

    this.multisig = await MultiSignature.new([owner], this.threshold, { from: owner });
    this.list = await AllowList.new(this.multisig.address, { from: owner });

    this.ddp = await DDP.new(this.multisig.address, { from: owner });
    this.eurxb = await EURxb.new(owner, { from: owner });
    this.bond = await BondToken.new('http://google.com', { from: owner });
    this.sat = await SecurityAssetToken.new('http://google.com', this.multisig.address, this.bond.address, this.list.address, { from: owner });
    this.bankV2 = await BankV2.new({ from: owner });
    // this.vault = await EURxbVault.new('xbEURO', 'xbEURO');

    let revenueToken;
    let controller;
    let strategy;
    let vault;
    let mock;
    [
      mock,
      controller,
      strategy,
      vault,
      revenueToken,
    ] = await vaultInfrastructureRedeployWithRevenueToken(
      owner,
      owner,
      ConsumerEURxbStrategy,
      ConsumerEURxbVault,
      this.bankV2,
    );

    this.vault = vault;
    await this.ddp.configure(this.bond.address, this.eurxb.address, this.list.address);
    await this.bond.configure(this.list.address, this.sat.address, this.ddp.address);
    await this.eurxb.configure(this.ddp.address, { from: owner });
    await this.bankV2.configure(this.vault.address, { from: owner });
    await this.bankV2.setBondDDP(this.bond.address, this.ddp.address, { from: owner });
    await this.vault.configure(this.bankV2.address, controller.address, { from: owner });

    await this.multisig.configure(this.list.address, this.ddp.address, this.sat.address, { from: owner });

    await this.multisig.allowAccount(client, { from: owner });
    await this.multisig.allowAccount(this.bankV2.address, { from: owner });
    await this.multisig.allowAccount(alice, { from: owner });
  });

  // describe('access test', () => {
  //   it('Ok: access test', async () => {
  //     expect(
  //       await this.list.isAllowedAccount(bob, { from: owner }),
  //       'bob must not be allowed',
  //     )
  //       .equal(false);
  //
  //     await this.multisig.allowAccount(bob, { from: owner });
  //
  //     expect(
  //       await this.list.isAllowedAccount(bob, { from: owner }),
  //       'bob must be allowed',
  //     )
  //       .equal(true);
  //   });
  // });
  //
  // describe('deposit', () => {
  //   it('Ok: deposit', async () => {
  //     const timestamp = await lastBlockTimestamp();
  //     await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 1748069828, { from: owner });
  //
  //     await this.eurxb.approve(this.bankV2.address, ether('1'), { from: client });
  //     await this.bankV2.deposit(this.eurxb.address, ether('1'), timestamp + 4 * YEAR, { from: client });
  //   });
  //
  //   it('Testing values', async () => {
  //     assert(
  //       !(await this.bond.hasToken(this.TOKEN_1)),
  //       'bond token must not exist at this time point',
  //     );
  //     await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 1748069828, { from: owner });
  //
  //     const ts = await this.eurxb.totalSupply.call();
  //     expect(ts)
  //       .to
  //       .be
  //       .bignumber
  //       .equal(this.ETHER_100.mul(new BN('75', 10))
  //         .div(new BN('100', 10)));
  //     const bf = await this.eurxb.balanceOf.call(client);
  //     expect(bf)
  //       .to
  //       .be
  //       .bignumber
  //       .equal(this.ETHER_100.mul(new BN('75', 10))
  //         .div(new BN('100', 10)));
  //   });
  //
  //   it('Revert: amount < 0', async () => {
  //     const timestamp = await lastBlockTimestamp();
  //     await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 1748069828, { from: owner });
  //
  //     await this.eurxb.approve(this.bankV2.address, ether('1'), { from: client });
  //     await expectRevert(this.bankV2.deposit(this.eurxb.address, ether('0'), timestamp + 4 * YEAR, { from: client }), 'BankV2: amount < 0');
  //   });
  // });
  //
  // describe('withdraw', () => {
  //   it('Ok: withdraw', async () => {
  //     const timestamp = await lastBlockTimestamp();
  //     assert(
  //       !(await this.bond.hasToken(this.TOKEN_1)),
  //       'bond token must not exist at this time point',
  //     );
  //     await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 4 * YEAR, { from: owner });
  //
  //     await this.eurxb.approve(this.bankV2.address, ether('1'), { from: client });
  //     await this.bankV2.deposit(this.eurxb.address, ether('1'), timestamp + 4 * YEAR, { from: client });
  //
  //     const xbEURObalance = await this.bankV2.xbEUROvault.call(client, { from: client });
  //     await this.bankV2.withdraw(xbEURObalance, { from: client });
  //     const clientXBEURObalance = await this.bankV2.balanceOf.call(client);
  //     assert.equal(clientXBEURObalance.toString(), xbEURObalance.toString());
  //   });
  //
  //   it('Revert: amount < 0', async () => {
  //     const timestamp = await lastBlockTimestamp();
  //     await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 4 * YEAR, { from: owner });
  //
  //     await this.eurxb.approve(this.bankV2.address, ether('1'), { from: client });
  //     await this.bankV2.deposit(this.eurxb.address, ether('1'), timestamp + 4 * YEAR, { from: client });
  //
  //     await expectRevert(this.bankV2.withdraw('0', { from: client }), 'BankV2: amount < 0');
  //   });
  //
  //   it('Revert: not enough funds', async () => {
  //     const timestamp = await lastBlockTimestamp();
  //     await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 4 * YEAR, { from: owner });
  //
  //     await this.eurxb.approve(this.bankV2.address, ether('1'), { from: client });
  //     await this.bankV2.deposit(this.eurxb.address, ether('1'), timestamp + 4 * YEAR, { from: client });
  //
  //     const xbEURObalance = await this.bankV2.xbEUROvault.call(client, { from: client });
  //     await expectRevert(this.bankV2.withdraw(xbEURObalance.add(new BN('10000', 10)), { from: client }), 'BankV2: not enough funds');
  //   });
  // });

  describe('redeemBond', () => {
    // it('Ok: redeeming bond as an owner', async () => {
    //   const timestamp = await lastBlockTimestamp();
    //   await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 4 * YEAR, { from: owner });
    //   const bf = await this.eurxb.balanceOf.call(client);
    //   assert.equal(bf.toString(), ether('75'));
    //
    //   const tokenInfo = await this.bond.getTokenInfo(1, { from: client });
    //   assert.equal(tokenInfo[0].toString(), ether('75'));
    //   assert(timestamp + 4 * YEAR + DAY >= tokenInfo[2].toString() && tokenInfo[2].toString() >= timestamp + 4 * YEAR, `Bond timestamp nas to be: ${timestamp + 4 * YEAR + DAY} > ${tokenInfo[2].toString()} > ${timestamp + 4 * YEAR}`);
    //
    //   await this.eurxb.approve(this.bankV2.address, bf, { from: client });
    //   await this.bankV2.deposit(this.eurxb.address, bf, timestamp + 4 * YEAR, { from: client });
    //   const balance = await this.eurxb.balanceOf.call(this.bankV2.address);
    //   assert.equal(balance.toString(), ether('75'));
    //
    //   await increaseTime(4 * YEAR + 3 * DAY);
    //   console.log(await lastBlockTimestamp());
    //   const xbEURO = await this.bankV2.xbEUROvault.call(client, { from: client });
    //   console.log(xbEURO.toString());
    //
    //   await this.bankV2.withdraw(ether('90'), { from: client });
    //
    //   await this.sat.approve(owner, 1, { from: client });
    //   await this.sat.approve(this.bankV2.address, 1, { from: client });
    //   await this.multisig.transferSecurityAssetToken(client, this.bankV2.address, 1, { from: owner });
    //
    //   await this.bankV2.setBondHolder(this.bond.address, 1, client, { from: owner });
    //   await this.bankV2.redeemBond(this.bond.address, 1, { from: client });
    // });
    //
    // it('Ok: redeeming bond as a foreigner', async () => {
    //   const timestamp = await lastBlockTimestamp();
    //   await this.multisig.mintSecurityAssetToken(alice, this.ETHER_100, 4 * YEAR, { from: owner });
    //   await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 4 * YEAR, { from: owner });
    //   const bf = await this.eurxb.balanceOf.call(client);
    //   assert.equal(bf.toString(), ether('75'));
    //
    //   const tokenInfo = await this.bond.getTokenInfo(1, { from: alice });
    //   assert.equal(tokenInfo[0].toString(), ether('75'));
    //
    //   await this.eurxb.approve(this.bankV2.address, bf, { from: alice });
    //   await this.bankV2.deposit(this.eurxb.address, bf, new BN(timestamp + 4 * YEAR, 10), { from: alice });
    //   const balance = await this.eurxb.balanceOf.call(this.bankV2.address);
    //   assert.equal(balance.toString(), ether('75'));
    //
    //   await increaseTime(4 * YEAR + 35 * DAY);
    //
    //   await this.bankV2.withdraw(ether('90'), { from: alice });
    //
    //   await this.sat.approve(owner, 1, { from: alice });
    //   await this.sat.approve(this.bankV2.address, 1, { from: alice });
    //   await this.multisig.transferSecurityAssetToken(alice, this.bankV2.address, 1, { from: owner });
    //
    //   await this.bankV2.setBondHolder(this.bond.address, 1, alice, { from: owner });
    //   await this.bankV2.setBondHolder(this.bond.address, 2, client, { from: owner });
    //   await this.bankV2.redeemBond(this.bond.address, 2, { from: alice });
    // });
    //
    // it('Revert: claim period is not finished yet', async () => {
    //   const timestamp = await lastBlockTimestamp();
    //   console.log(timestamp);
    //
    //   await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, new BN(4 * YEAR, 10), { from: owner });
    //   const bf = await this.eurxb.balanceOf.call(client);
    //   assert.equal(bf.toString(), ether('75'));
    //
    //   const tokenInfo = await this.bond.getTokenInfo(1, { from: client });
    //   assert.equal(tokenInfo[0].toString(), ether('75'));
    //   assert(timestamp + 4 * YEAR + 2 * DAY >= tokenInfo[2].toString() && tokenInfo[2].toString() >= timestamp + 4 * YEAR, `Bond timestamp nas to be: ${timestamp + 4 * YEAR + DAY} > ${tokenInfo[2].toString()} > ${timestamp + 4 * YEAR}`);
    //
    //   await this.eurxb.approve(this.bankV2.address, bf, { from: client });
    //   await this.bankV2.deposit(this.eurxb.address, bf, new BN(timestamp + 4 * YEAR, 10), { from: client });
    //   const balance = await this.eurxb.balanceOf.call(this.bankV2.address);
    //   assert.equal(balance.toString(), ether('75'));
    //
    //   await increaseTime(4 * YEAR);
    //   console.log(await lastBlockTimestamp());
    //
    //   const xbEURO = await this.bankV2.xbEUROvault.call(client, { from: client });
    //   console.log(xbEURO.toString());
    //
    //   await this.bankV2.withdraw(ether('90'), { from: client });
    //
    //   await this.sat.approve(owner, 1, { from: client });
    //   await this.sat.approve(this.bankV2.address, 1, { from: client });
    //   await this.multisig.transferSecurityAssetToken(client, this.bankV2.address, 1, { from: owner });
    //
    //   await this.bankV2.setBondHolder(this.bond.address, 1, client, { from: owner });
    //   await this.bankV2.redeemBond(this.bond.address, 1, { from: client });
    // });

    it('Ok: redeeming EURxB and EURxC bonds as an owner', async () => {
      // deploy the second bond
      const multisig01 = await MultiSignature.new([owner], this.threshold, { from: owner });
      const list01 = await AllowList.new(multisig01.address, { from: owner });

      const ddp01 = await DDP.new(multisig01.address, { from: owner });
      const eurxc = await EURxb.new(owner, { from: owner });
      const bond01 = await BondToken.new('http://google.com', { from: owner });
      const sat01 = await SecurityAssetToken.new('http://google.com', multisig01.address, bond01.address, list01.address, { from: owner });
      await this.bankV2.setBondDDP(bond01.address, ddp01.address, { from: owner });

      await ddp01.configure(bond01.address, eurxc.address, list01.address);
      await bond01.configure(list01.address, sat01.address, ddp01.address);
      await eurxc.configure(ddp01.address, { from: owner });

      await multisig01.configure(list01.address, ddp01.address, sat01.address, { from: owner });

      await multisig01.allowAccount(client, { from: owner });
      await multisig01.allowAccount(this.bankV2.address, { from: owner });
      await multisig01.allowAccount(alice, { from: owner });

      // test itself
      const timestamp = await lastBlockTimestamp();

      // minting EURxB
      await this.multisig.mintSecurityAssetToken(client, this.ETHER_100, 4 * YEAR, { from: owner });
      const bf = await this.eurxb.balanceOf.call(client);
      assert.equal(bf.toString(), ether('75'));

      // minting EURxC
      await multisig01.mintSecurityAssetToken(client, this.ETHER_100, 4 * YEAR, { from: owner });
      const bf01 = await eurxc.balanceOf.call(client);
      assert.equal(bf01.toString(), ether('75'));

      // checking EURxB bond
      const tokenInfo = await this.bond.getTokenInfo(1, { from: client });
      assert.equal(tokenInfo[0].toString(), ether('75'));
      assert(timestamp + 4 * YEAR + DAY >= tokenInfo[2].toString() && tokenInfo[2].toString() >= timestamp + 4 * YEAR, `Bond timestamp nas to be: ${timestamp + 4 * YEAR + DAY} > ${tokenInfo[2].toString()} > ${timestamp + 4 * YEAR}`);

      // checking EURxC bond
      const tokenInfo01 = await this.bond.getTokenInfo(1, { from: client });
      assert.equal(tokenInfo01[0].toString(), ether('75'));
      assert(timestamp + 4 * YEAR + DAY >= tokenInfo01[2].toString() && tokenInfo01[2].toString() >= timestamp + 4 * YEAR, `Bond timestamp nas to be: ${timestamp + 4 * YEAR + DAY} > ${tokenInfo01[2].toString()} > ${timestamp + 4 * YEAR}`);

      // depositing EURxB
      await this.eurxb.approve(this.bankV2.address, ether("75"), { from: client });
      await this.bankV2.deposit(this.eurxb.address, ether("75"), timestamp + 4 * YEAR, { from: client });
      const balance = await this.eurxb.balanceOf.call(this.bankV2.address);
      assert.equal(balance.toString(), ether('75'));

      // depositing EURxC
      await eurxc.approve(this.bankV2.address, bf01, { from: client });
      await this.bankV2.deposit(eurxc.address, bf01, timestamp + 4 * YEAR, { from: client });
      const balance01 = await eurxc.balanceOf.call(this.bankV2.address);
      assert.equal(balance01.toString(), ether('75'));

      const vaultBalance = await this.bankV2.balanceOf.call(this.vault.address);
      console.log(vaultBalance.toString());

      // 4 years later...
      await increaseTime(4 * YEAR + 3 * DAY);

      const xbEURO = await this.bankV2.xbEUROvault.call(client, { from: client });
      console.log(xbEURO.toString());

      // withdraw xbEURO
      await this.bankV2.withdraw(ether('90'), { from: client });

      const bankV2xbEUROBalance = await this.bankV2.balanceOf.call(this.bankV2.address);
      console.log(bankV2xbEUROBalance.toString());
      await this.bankV2.withdraw(ether('90'), { from: client });

      // transferring EURxB SAT to bankV2
      await this.sat.approve(owner, 1, { from: client });
      await this.sat.approve(this.bankV2.address, 1, { from: client });
      await this.multisig.transferSecurityAssetToken(client, this.bankV2.address, 1, { from: owner });

      // transferring EURxC SAT to bankV2
      await sat01.approve(owner, 1, { from: client });
      await sat01.approve(this.bankV2.address, 1, { from: client });
      await multisig01.transferSecurityAssetToken(client, this.bankV2.address, 1, { from: owner });

      // redeeming EURxB bond
      await this.bankV2.setBondHolder(this.bond.address, 1, client, { from: owner });
      await this.bankV2.redeemBond(this.bond.address, 1, { from: client });

      // redeeming EURxC bond
      await this.bankV2.setBondHolder(bond01.address, 1, client, { from: owner });
      await this.bankV2.redeemBond(bond01.address, 1, { from: client });
    });
  });
});
