/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { ZERO } = require('../utils/common');

const {
  actorStake, activeActor, deployAndConfigureGovernance
} = require('../governance_test.js');

const MockContract = artifacts.require("MockContract");

const MockToken = artifacts.require('MockToken');
const ExecutorMock = artifacts.require('ExecutorMock');

contract('InstitutionalEURxbStrategy', (accounts) => {

  // function configure(
  //   address _eurxbAddress,
  //   address _controllerAddress
  // ) initializer external {
  //   _eurxb = _eurxbAddress;
  //   _controller = _controllerAddress;
  // }
  it('should configure properly', async () => {

  });

  // function want() override external view returns(address) {
  //     return _eurxb;
  // }
  it('should return \"want\" token', async () => {

  });

  // function deposit() override external {
  //     revert("Not implemented");
  // }
  it('should deposit the balance', async () => {

  });

  // // NOTE: must exclude any tokens used in the yield
  // // Controller role - withdraw should return to Controller
  // function withdraw(address _token) override onlyController external {
  //     require(address(_token) != address(_eurxb), "!want");
  //     uint256 balance = IERC20(_token).balanceOf(address(this));
  //     IERC20(_token).safeTransfer(_controller, balance);
  // }
  it('should withdraw the balance of the non-want token', async () => {

  });

  // // Controller | Vault role - withdraw should always return to Vault
  // // Withdraw partial funds, normally used with a vault withdrawal
  // function withdraw(uint256 _amount) override onlyController external {
  //     uint256 _balance = IERC20(_eurxb).balanceOf(address(this));
  //     if (_balance < _amount) {
  //         _amount = _withdrawSome(_amount.sub(_balance));
  //         _amount = _amount.add(_balance);
  //     }
  //     address _vault = IController(_controller).vaults(address(this));
  //     require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
  //     IERC20(_eurxb).safeTransfer(_vault, _amount);
  // }
  it('should withdraw the amount of \"want\" token', async () => {

  });

  // function skim() override external {
  //     revert("Not implemented");
  // }
  it('should skim', async () => {

  });

  // // Controller | Vault role - withdraw should always return to Vault
  // function withdrawAll() override external returns(uint256) {
  //     revert("Not implemented");
  // }
  it('should withdraw all of the \"want\" token', async () => {

  });

  // // balance of this address in "want" tokens
  // function balanceOf() override external view returns(uint256) {
  //     return IERC20(_eurxb).balanceOf(address(this));
  // }
  it('should return balance \"want\" token of this contract', async () => {

  });

  // function withdrawalFee() override external view returns(uint256) {
  //     revert("Not implemented");
  // }
  it('should return withdrawal fee', async () => {

  });

});
