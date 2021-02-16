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

const { ZERO, CONVERSION_WEI_CONSTANT } = require('./utils/common');
const { vaultInfrastructureRedeploy } = require('./utils/vault_infrastructure_redeploy');

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const Controller = artifacts.require("Controller");
const ERC20 = artifacts.require("ERC20");
const IStrategy = artifacts.require("IStrategy");
const MockToken = artifacts.require('MockToken');

const MockContract = artifacts.require("MockContract");

contract('Controller', (accounts) => {

  const governance = accounts[0];
  const miris = accounts[1];
  const strategist = accounts[2];

  const treasuryAddress = ZERO_ADDRESS;

  var revenueToken;
  var controller;
  var strategy;
  var vault;
  var mock;

  const getMockTokenPrepared = async (mintTo, mockedAmount) => {
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
    await mockToken.approve(mintTo, mockedAmount, {from: miris});
    await mockToken.transfer(mintTo, mockedAmount, {from: miris});
    return mockToken;
  };

  beforeEach(async () => {
    [mock, controller, strategy, vault, revenueToken] = await vaultInfrastructureRedeploy(
      governance,
      strategist,
      treasuryAddress
    );
  });

  it('should configure properly', async () => {
    expect(await controller.strategist()).to.be.equal(strategist);
    expect(await controller.rewards()).to.be.equal(treasuryAddress);
  });

  it('should evacuate tokens from controller', async () => {
    const amount = ether('10');
    const toEvacuateByGovernance = ether('5');
    const toEvacuateByStrategist = ether('5');
    const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
    mockToken.approve(controller.address, amount, {from: miris});
    mockToken.transfer(controller.address, amount, {from: miris});
    await controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByGovernance,
      {from: governance}
    );
    await controller.inCaseTokensGetStuck(
      mockToken.address, toEvacuateByStrategist,
      {from: strategist}
    );
    expect(await mockToken.balanceOf(governance)).to.be.bignumber.equals(toEvacuateByGovernance);
    expect(await mockToken.balanceOf(strategist)).to.be.bignumber.equals(toEvacuateByStrategist);
  });

  it('should evacuate all tokens from strategy', async () => {
    await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, revenueToken.address),
      "!want");
    const mockedBalance = ether('10');
    var mockToken = await getMockTokenPrepared(strategy.address, mockedBalance);
    await controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address);
    expect(await mockToken.balanceOf(controller.address)).to.be.bignumber.equal(mockedBalance);

    mock = await MockContract.new();
    mockToken = await MockToken.at(mock.address);
    await expectRevert(controller.inCaseStrategyTokenGetStuck(strategy.address, mockToken.address),
      "!transfer");
  });

  it('should withdraw tokens from strategy', async () => {
    var mockedBalance = ether('10');
    var toWithdraw = ether('5');
    const balanceOfStrategyCalldata = revenueToken.contract
      .methods.balanceOf(strategy.address).encodeABI();
    await mock.givenCalldataReturnUint(balanceOfStrategyCalldata, mockedBalance);

    await strategy.setController(mock.address, {from: governance});

    const vaultsCalldata = controller.contract
      .methods.vaults(revenueToken.address).encodeABI();

    await mock.givenCalldataReturnAddress(vaultsCalldata, ZERO_ADDRESS);

    const invalidVault = await (await Controller.at(await strategy.controller()))
      .vaults(revenueToken.address);

    expect(invalidVault).to.be.equal(ZERO_ADDRESS);

    await strategy.setController(controller.address, {from: governance});

    const transferCalldata = revenueToken.contract
      .methods.transfer(miris, 0).encodeABI();

    await mock.givenMethodReturnBool(transferCalldata, false);

    await expectRevert(controller.withdraw(revenueToken.address, toWithdraw),
      "!transferStrategy");
  });

  // // function setParts(uint256 _newParts) onlyGovernance external {
  // //     require(parts != _newParts, "!old");
  // //     parts = _newParts;
  // // }
  // it('should set pairs', async () => {
  //
  // });
  //
  //
  // // function setRewards(address _newTreasury) onlyGovernance external {
  // //     require(_treasury != _newTreasury, 'old');
  // //     _treasury = _newTreasury;
  // // }
  // it('should set treasury address', async () => {
  //
  // });
  //
  // // function setOneSplit(address _newOneSplit) onlyGovernance external {
  // //     require(_oneSplit != _newOneSplit, 'old');
  // //     _oneSplit = _newOneSplit;
  // // }
  // it('should set one split address', async () => {
  //
  // });
  //
  // // function setStrategist(address _newStrategist) onlyGovernance external {
  // //     require(strategist != _newStrategist, 'old');
  // //     strategist = _newStrategist;
  // // }
  // it('should set strategist address', async () => {
  //
  // });
  //
  // // function rewards() override external view returns(address) {
  // //     return _treasury;
  // // }
  // it('should get treasury address', async () => {
  //
  // });
  //
  // // function vaults(address _token) override external view returns(address) {
  // //     return _vaults[_token];
  // // }
  // it('should get vault by token', async () => {
  //
  // });
  //
  // // function strategies(address _token) override external view returns(address) {
  // //     return _strategies[_token];
  // // }
  // it('should get strategy by token', async () => {
  //
  // });
  //
  // // function setVault(address _token, address _vault)
  // //     override
  // //     onlyGovernanceOrStrategist
  // //     external
  // // {
  // //     require(_vaults[_token] == address(0), "!vault 0");
  // //     _vaults[_token] = _vault;
  // // }
  // it('should set vault by token', async () => {
  //
  // });
  //
  // // function setConverter(
  // //     address _input,
  // //     address _output,
  // //     address _converter
  // // ) onlyGovernanceOrStrategist external {
  // //     converters[_input][_output] = _converter;
  // // }
  // it('should set converter address', async () => {
  //
  // });
  //
  // // function setStrategy(address _token, address _strategy) override onlyGovernanceOrStrategist external {
  // //     require(_approvedStrategies[_token][_strategy], "!approved");
  // //     address _current = _strategies[_token];
  // //     if (_current != address(0)) {
  // //         IStrategy(_current).withdrawAll();
  // //     }
  // //     _strategies[_token] = _strategy;
  // // }
  // it('should set strategy address', async () => {
  //
  // });
  //
  // // function setApproveStrategy(address _token, address _strategy, bool _status) onlyGovernance external {
  // //     _approvedStrategies[_token][_strategy] = _status;
  // // }
  // it('should approve strategy address', async () => {
  //
  // });
  //
  // // function approvedStrategies(address _token, address _strategy) override external view returns(bool) {
  // //     return _approvedStrategies[_token][_strategy];
  // // }
  // it('should get approved strategy address', async () => {
  //
  // });
  //
  // // function earn(address _token, uint256 _amount) override public {
  // //     address _strategy = _strategies[_token];
  // //     address _want = IStrategy(_strategy).want();
  // //     if (_want != _token) {
  // //         address converter = converters[_token][_want];
  // //         require(converter != address(0), '!converter');
  // //         IERC20(_token).safeTransfer(converter, _amount);
  // //         _amount = IConverter(converter).convert(_strategy);
  // //         IERC20(_want).safeTransfer(_strategy, _amount);
  // //     } else {
  // //         IERC20(_token).safeTransfer(_strategy, _amount);
  // //     }
  // //     IStrategy(_strategy).deposit();
  // // }
  // it('should send tokens to the strategy and earn', async () => {
  //
  // });
  //
  // // // Only allows to withdraw non-core strategy tokens ~ this is over and above normal yield
  // // function harvest(address _strategy, address _token) override external {
  // //     require(_token != _want, "!want");
  // //     // This contract should never have value in it, but just incase since this is a public call
  // //     uint256 _before = IERC20(_token).balanceOf(address(this));
  // //     IStrategy(_strategy).withdraw(_token);
  // //     uint256 _after =  IERC20(_token).balanceOf(address(this));
  // //     if (_after > _before) {
  // //         uint256 _amount = _after.sub(_before);
  // //         address _want = IStrategy(_strategy).want();
  // //         uint256[] memory _distribution;
  // //         uint256 _expected;
  // //         _before = IERC20(_want).balanceOf(address(this));
  // //         IERC20(_token).safeApprove(_oneSplit, 0);
  // //         IERC20(_token).safeApprove(_oneSplit, _amount);
  // //         (_expected, _distribution) = IOneSplitAudit(_oneSplit).getExpectedReturn(_token, _want, _amount, parts, 0);
  // //         IOneSplitAudit(_oneSplit).swap(_token, _want, _amount, _expected, _distribution, 0);
  // //         _after = IERC20(_want).balanceOf(address(this));
  // //         if (_after > _before) {
  // //             _amount = _after.sub(_before);
  // //             uint256 _reward = _amount.mul(split).div(max);
  // //             earn(_want, _amount.sub(_reward));
  // //             IERC20(_want).safeTransfer(_treasury, _reward);
  // //         }
  // //     }
  // // }
  // it('should harvest tokens from the strategy', async () => {
  //
  // });

});
