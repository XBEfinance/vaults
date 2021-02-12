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

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const Controller = artifacts.require("Controller");
const ERC20 = artifacts.require("ERC20");
const IStrategy = artifacts.require("IStrategy");

const MockContract = artifacts.require("MockContract");

contract('InstitutionalEURxbVault', (accounts) => {

  const governance = accounts[0];
  const miris = accounts[1];
  const strategist = accounts[2];

  const stardId = ZERO;
  const initialTotalSupply = ether('15000');
  const treasuryAddress = ZERO_ADDRESS;

  var governanceContract;
  var governanceToken;
  var stakingRewardsToken;
  var revenueToken;
  var controller;
  var strategy;
  var vault;
  var mock;

  const testMin = new BN('9600');

  beforeEach(async () => {
    [ governanceContract, governanceToken, stakingRewardsToken ] = await deployAndConfigureGovernance(
      stardId,
      initialTotalSupply,
      governance
    );

    mock = await MockContract.new();
    controller = await Controller.new();
    strategy = await InstitutionalEURxbStrategy.new();
    vault = await InstitutionalEURxbVault.new();
    revenueToken = await ERC20.at(mock.address);

    await strategy.configure(
      revenueToken.address,
      controller.address
    );

    await contoller.configure(
      treasuryAddress,
      strategist
    );

    await vault.configure(
      revenueToken.address,
      governance,
      controller.address,
      strategy.address
    );

  });

  it('should configure successfully', async () => {
    expect(await vault.controller()).to.be.equal(controller.address);
    expect(await vault.governance()).to.be.equal(governance);
    expect(await vault.eurxb()).to.be.equal(revenueToken.address);
    expect(await controller.vaults(revenueToken.address)).to.be.equal(vault.address);
    expect(await controller.strategies(revenueToken.address)).to.be.equal(strategy.address);
  });

  it('should set min', async () => {
    await vault.setMin(testMin, {from: governance});
    expect(await vault.min()).to.be.bignumber.equal(testMin);
    await expectRevert(vault.setMin(testMin, {from: governance}), '!new');
    await expectRevert(vault.setMin(testMin, {from: miris}), '!governance');
  });

  it('should set controller', async () => {
    await vault.setController(ZERO_ADDRESS, {from: governance});
    expect(await vault.controller()).to.be.bignumber.equal(ZERO_ADDRESS);
    await expectRevert(vault.setController(ZERO_ADDRESS, {from: governance}), '!new');
    await expectRevert(vault.setController(ZERO_ADDRESS, {from: miris}), '!governance');
  });

  // function balance() override public view returns(uint256) {
  //     return eurxb.balanceOf(address(this)).add(
  //         IStrategy(
  //             IController(_controller).strategies(address(eurxb))
  //         ).balanceOf()
  //     );
  // }
  it('should calculate balance correctly', async () => {
    // mock eurxb balance of this
    // mock balance of strategy
  });

  // Custom logic in here for how much the vault allows to be borrowed
  // Sets minimum required on-hand to keep small withdrawals cheap
  // function available() public view returns (uint) {
  //     return eurxb.balanceOf(address(this)).mul(min).div(max);
  // }
  it('should calculate available balance', async () => {

  });

  // function token() override external view returns(address) {
  //     return address(this);
  // }
  it('should get vault token address', async () => {

  });

  // function underlying() override external view returns(address) {
  //     return address(eurxb);
  // }
  it('should get eurxb token address', async () => {

  });

  // function controller() override external view returns(address) {
  //     return _controller;
  // }
  it('should get controller', async () => {

  });

  // function getPricePerFullShare() override external view returns(uint256) {
  //     return balance().mul(1e18).div(totalSupply());
  // }
  it('should get price per full share', async () => {

  });

  // function deposit(uint256 _amount) override public {
  //     uint256 _pool = balance();
  //     uint256 _before = eurxb.balanceOf(address(this));
  //     eurxb.safeTransferFrom(_msgSender(), address(this), _amount);
  //     uint256 _after = eurxb.balanceOf(address(this));
  //     _amount = _after.sub(_before); // Additional check for deflationary tokens
  //     uint256 shares = 0;
  //     if (totalSupply() == 0) {
  //         shares = _amount;
  //     } else {
  //         shares = (_amount.mul(totalSupply())).div(_pool);
  //     }
  //     _mint(_msgSender(), shares);
  // }
  it('should deposit correctly', async () => {

  });

  // function depositAll() override external {
  //     deposit(eurxb.balanceOf(_msgSender()));
  // }
  it('should deposit all correctly', async () => {

  });

  // function withdraw(uint256 _shares) override public {
  //     uint256 r = (balance().mul(_shares)).div(totalSupply());
  //     _burn(_msgSender(), _shares);
  //     // Check balance
  //     uint256 b = eurxb.balanceOf(address(this));
  //     if (b < r) {
  //         uint256 _withdraw = r.sub(b);
  //         IController(_controller).withdraw(address(eurxb), _withdraw);
  //         uint256 _after = eurxb.balanceOf(address(this));
  //         uint256 _diff = _after.sub(b);
  //         if (_diff < _withdraw) {
  //             r = b.add(_diff);
  //         }
  //     }
  //     eurxb.safeTransfer(_msgSender(), r);
  // }
  it('should withdraw correctly', async () => {

  });

  // function withdrawAll() override external {
  //     withdraw(eurxb.balanceOf(_msgSender()));
  // }
  it('should withdraw all correctly', async () => {

  });

  // function earn() override external {
  //   uint256 _bal = available();
  //   eurxb.safeTransfer(_controller, _bal);
  //   IController(_controller).earn(address(eurxb), _bal);
  // }
  it('should earn correctly', async () => {

  });

});
