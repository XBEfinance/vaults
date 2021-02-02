/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');

const Governance = artifacts.require('Governance');
const XBE = artifacts.require('XBG');

contract('Governance', (accounts) => {

  const miris = accounts[1];
  const alice = accounts[2];
  const bob = accounts[3];

  before(async () => {
  });

  beforeEach(async () => {
  });

  describe('staking', () => {

    // function totalSupply() public view returns(uint256) {
    //     return _totalSupply;
    // }
    //
    // function balanceOf(address _account) public view returns(uint256) {
    //     return _balances[_account];
    // }
    //
    // function stake(uint256 _amount) public virtual {
    //     _totalSupply = _totalSupply.add(_amount);
    //     _balances[msg.sender] = _balances[msg.sender].add(_amount);
    //     governanceToken.safeTransferFrom(msg.sender, address(this), _amount);
    // }
    //
    // function withdraw(uint256 _amount) public virtual {
    //     _totalSupply = _totalSupply.sub(_amount);
    //     _balances[msg.sender] = _balances[msg.sender].sub(_amount);
    //     governanceToken.safeTransfer(msg.sender, _amount);
    // }

    beforeEach(async () => {

    });

    it('check miris is allow list admin', async () => {
    });

  });

  describe('voting', () => {

    beforeEach(async () => {

    });

    it('check miris is allow list admin', async () => {

    });
  });

  describe('rewards', () => {
      // TODO: This will be the module for testing that the rewards are given to the stakers.
  });

});
