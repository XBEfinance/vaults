const { expect } = require('chai');
const {
  expectEvent,
  expectRevert,
  ether,
  time
} = require('@openzeppelin/test-helpers');

const Bank = artifacts.require('Bank');
const EURxbMock = artifacts.require('EURxbMock');

contract('Bank', (accounts) => {
    const minter = accounts[1];
    const client = accounts[2];

    beforeEach(async () => {
        this.eurxb = await EURxbMock.new();
        await this.eurxb.mint(minter, ether('1000.0'));
        await this.eurxb.addNewMaturity(ether('1000.0'), await time.latest())
        this.bank = await Bank.new();
        await this.bank.configure(this.eurxb.address);
    });

    describe('deposit', () => {
        it('should fail if amount is less than or equal to zero', async () => {
            await expectRevert(this.bank.deposit(0, { from: client }), '_amount must be greater than zero');
        });

        it('should return correct amount deposit', async () => {
            await this.eurxb.transfer(client, ether('100.0'), { from: minter });
            await this.eurxb.approve(this.bank.address, ether('100.0'), { from: client });
            const deposit = await this.bank.deposit(ether('100.0'), { from: client });

            // Amount of user deposits
            let amountDeposit = await this.bank.getDeposit(client);
            expect(amountDeposit).to.be.bignumber.equal(ether('100.0'));

            // Amount of user Bank tokens
            let amountBankToken = await this.bank.balanceOf(client);
            expect(amountBankToken).to.be.bignumber.equal(ether('100.0'));

            // Index
            const firstIndex = await this.bank.getIndex(client);
            let expIndex = await this.eurxb.expIndex();
            expect(expIndex).to.be.bignumber.equal(firstIndex);

            // Event
            expectEvent(deposit, 'Deposit', { _user: client, _amount: ether('100.0') });

            await time.increase(time.duration.years('1'));

            await this.eurxb.transfer(client, ether('100.0'), { from: minter });
            await this.eurxb.approve(this.bank.address, ether('100.0'), { from: client });
            await this.bank.deposit(ether('100.0'), { from: client });

            // Amount of user deposits
            amountDeposit = await this.bank.getDeposit(client);
            expect(amountDeposit).to.be.bignumber.lt(ether('207.000001'));
            expect(amountDeposit).to.be.bignumber.gt(ether('206.999999'));

            // Amount of user Bank tokens
            amountBankToken = await this.bank.balanceOf(client);
            expect(amountBankToken).to.be.bignumber.lt(ether('207.000001'));
            expect(amountBankToken).to.be.bignumber.gt(ether('206.999999'));

            // Index
            const newIndex = await this.bank.getIndex(client);
            expIndex = await this.eurxb.expIndex();
            expect(expIndex).to.be.bignumber.equal(newIndex);
            expect(newIndex).to.be.bignumber.not.equal(firstIndex);
        });
    });

    describe('withdraw', () => {
        it('should fail if amount is less than or equal to zero', async () => {
            await expectRevert(this.bank.withdraw(0, { from: client }), '_amount must be greater than zero');
        });

        it('should fail if no deposit in the bank', async () => {
            await expectRevert(this.bank.withdraw(ether('100.0'), { from: client }), 'there is no deposit in the bank');
        });

        it('should return correct amount withdraw', async () => {
            await this.eurxb.transfer(client, ether('100.0'), { from: minter });
            await this.eurxb.approve(this.bank.address, ether('100.0'), { from: client });
            await this.bank.deposit(ether('100.0'), { from: client });

            await time.increase(time.duration.years('1'));
            const withdraw = await this.bank.withdraw(ether('55.0'), { from: client });

            // Amount of user EURxb tokens
            let balance = await this.eurxb.balanceOf(client);
            expect(balance).to.be.bignumber.lt(ether('62.000001'));
            expect(balance).to.be.bignumber.gt(ether('61.999999'));

            // Amount of user deposits
            let amountDeposit = await this.bank.getDeposit(client);
            expect(amountDeposit).to.be.bignumber.equal(ether('45.0'));

            // Amount of user Bank tokens
            let amountBankToken = await this.bank.balanceOf(client);
            expect(amountBankToken).to.be.bignumber.equal(ether('45.0'));

            // Index
            const firstIndex = await this.bank.getIndex(client);
            let expIndex = await this.eurxb.expIndex();
            expect(expIndex).to.be.bignumber.equal(firstIndex);

            // Event
            expectEvent(withdraw, 'Withdraw', { _user: client, _amount: ether('55.0') });

            await time.increase(time.duration.years('1'));
            await this.bank.withdraw(ether('45.0'), { from: client });

            // Amount of user EURxb tokens
            balance = await this.eurxb.balanceOf(client);
            expect(balance).to.be.bignumber.lt(ether('114.5'));
            expect(balance).to.be.bignumber.gt(ether('114.0'));

            // Amount of user deposits
            amountDeposit = await this.bank.getDeposit(client);
            expect(amountDeposit).to.be.bignumber.equal(ether('0'));

            // Amount of user Bank tokens
            amountBankToken = await this.bank.balanceOf(client);
            expect(amountBankToken).to.be.bignumber.equal(ether('0'));

            // Index
            const newIndex = await this.bank.getIndex(client);
            expIndex = await this.eurxb.expIndex();
            expect(expIndex).to.be.bignumber.equal(newIndex);
            expect(newIndex).to.be.bignumber.not.equal(firstIndex);
        });
    });

    describe('withdrawInterest', () => {
        it('should return correct amount interest EURxb token', async () => {
            await this.eurxb.transfer(client, ether('100.0'), { from: minter });
            await this.eurxb.approve(this.bank.address, ether('100.0'), { from: client });
            await this.bank.deposit(ether('100.0'), { from: client });

            await time.increase(time.duration.years('1'));
            const withdraw = await this.bank.withdrawInterestEUR({ from: client });

            // Event
            expectEvent(withdraw, 'WithdrawInterestEUR', { _user: client });

            // Amount of user EURxb tokens
            const balance = await this.eurxb.balanceOf(client);
            expect(balance).to.be.bignumber.lt(ether('7.000001'));
            expect(balance).to.be.bignumber.gt(ether('6.999999'));

            // Amount of user deposits
            const amountDeposit = await this.bank.getDeposit(client);
            expect(amountDeposit).to.be.bignumber.equal(ether('100.0'));
        });

        it('should return correct amount interest Bank token', async () => {
            await this.eurxb.transfer(client, ether('100.0'), { from: minter });
            await this.eurxb.approve(this.bank.address, ether('100.0'), { from: client });
            await this.bank.deposit(ether('100.0'), { from: client });

            await time.increase(time.duration.years('1'));
            const withdraw = await this.bank.withdrawInterestBank({ from: client });

            // Event
            expectEvent(withdraw, 'WithdrawInterestBank', { _user: client });

            // Amount of user EURxb tokens
            const balance = await this.bank.balanceOf(client);
            expect(balance).to.be.bignumber.lt(ether('107.000001'));
            expect(balance).to.be.bignumber.gt(ether('106.999999'));

            // Amount of user deposits
            const amountDeposit = await this.bank.getDeposit(client);
            expect(amountDeposit).to.be.bignumber.lt(ether('107.000001'));
            expect(amountDeposit).to.be.bignumber.gt(ether('106.999999'));
        });
    });
});