const { expect } = require('chai');
const {
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');

const BankV2 = artifacts.require('BankV2');
const EURxb = artifacts.require('EURxb');
const DDP = artifacts.require('DDP');
const BondToken = artifacts.require('BondToken');
const SecurityAssetToken = artifacts.require('SecurityAssetToken');

contract('BankV2', (accounts) => {
  const owner = accounts[0];
  const minter = accounts[1];
  const client = accounts[2];
  const alice = accounts[3];

  beforeEach(async () => {
    this.ddp = await DDP.new(owner, { from: owner });
    this.eurxb = await EURxb.new(owner, { from: owner });
    this.bond = await BondToken.new('http://google.com', { from: owner });
    this.sat = await SecurityAssetToken.new('http://google.com', owner, this.bond.address, owner, { from: owner });
    this.bankV2 = await BankV2.new({ from: owner });

    await this.ddp.configure(this.bond.address, this.eurxb.address, owner);
    await this.bond.configure(owner, this.sat.address, this.ddp.address);
    await this.eurxb.configure(this.ddp.address, { from: owner });
    await this.bankV2.configure(this.eurxb.address, this.ddp.address, '0x0000000000000000000000000000000000000002', { from: owner });

    await this.sat.mint(client, ether('2'), { from: owner });
    // console.log(this.eurxb.address);
    // await this.eurxb.addNewMaturity(ether('1000000'), await time.latest());

    // console.log(this.bankV2.address);
  });

  describe('deposit', () => {
    it('should fail if amount is less than or equal to zero', async () => {
      // expectRevert(await this.bankV2.deposit(this.eurxb.address, '0', '1740310404', { from: owner }));
    });

    it('should be ok', async () => {
      await this.eurxb.transfer(client, ether('1.5'), { from: minter });
      await this.eurxb.approve(this.bankV2.address, ether('1.5'), { from: client });
      await this.bankV2.deposit(this.eurxb.address, ether('1'), '1740310404', { from: client });
    });
  });
});
