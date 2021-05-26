const { expect } = require('chai');
const {
  expectEvent,
  expectRevert,
  ether,
  BN,
  time,
} = require('@openzeppelin/test-helpers');
const { vaultInfrastructureRedeployWithRevenueToken } = require('../utils/vault_infrastructure_redeploy');

const BankV2 = artifacts.require('BankV2');
const EURxb = artifacts.require('EURxb');
const DDP = artifacts.require('DDP');
const BondToken = artifacts.require('BondToken');
const SecurityAssetToken = artifacts.require('SecurityAssetToken');
const AllowList = artifacts.require('AllowList');
const ConsumerEURxbStrategy = artifacts.require('ConsumerEURxbStrategy');
const ConsumerEURxbVault = artifacts.require('ConsumerEURxbVault');

contract('BankV2', (accounts) => {
  const owner = accounts[0];
  const minter = accounts[1];
  const client = accounts[2];
  const alice = accounts[3];

  beforeEach(async () => {
    this.ETHER_100 = web3.utils.toWei('100', 'ether');
    this.ETHER_0 = web3.utils.toWei('0', 'ether');
    this.DATE_SHIFT = new BN('10000');
    this.TOKEN_1 = new BN('1');
    this.TOKEN_2 = new BN('2');

    this.list = await AllowList.new(owner);
    this.ddp = await DDP.new(owner, { from: owner });
    this.eurxb = await EURxb.new(owner, { from: owner });
    this.bond = await BondToken.new('http://google.com', { from: owner });
    this.sat = await SecurityAssetToken.new('http://google.com', owner, this.bond.address, this.list.address, { from: owner });
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
      this.bankV2
    );
    this.vault = vault;
    await this.ddp.configure(this.bond.address, this.eurxb.address, this.list.address);
    await this.bond.configure(this.list.address, this.sat.address, this.ddp.address);
    await this.eurxb.configure(this.ddp.address, { from: owner });
    await this.bankV2.configure(this.eurxb.address, this.ddp.address, this.vault.address, this.bond.address, { from: owner });
    await this.vault.configure(this.bankV2.address, controller.address, { from: owner });

    await this.list.allowAccount(client);
  });

  describe('deposit', () => {
    it('should fail', async () => {
      assert(
        !(await this.bond.hasToken(this.TOKEN_1)),
        'bond token must not exist at this time point',
      );
      await this.sat.mint(client, this.ETHER_100, 1748069828, { from: owner });
    });

    it('should be ok', async () => {
      assert(
        !(await this.bond.hasToken(this.TOKEN_1)),
        'bond token must not exist at this time point',
      );
      await this.sat.mint(client, this.ETHER_100, 1748069828, { from: owner });
      // await this.eurxb.transfer(client, ether('1.5'), { from: minter });
      const ts = await this.eurxb.totalSupply.call();
      console.log(ts.toString());
      const bf = await this.eurxb.balanceOf.call(client);
      console.log(bf.toString());

      await this.eurxb.approve(this.bankV2.address, ether('1'), { from: client });
      await this.bankV2.deposit(this.eurxb.address, ether('1'), '1758069828', { from: client });
      const balance = await this.bankV2.balanceOf.call(this.vault.address);
      console.log(balance.toString());
    });
  });
});
