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
} = require('./governance_test.js');

const MockContract = artifacts.require("MockContract");

const MockToken = artifacts.require('MockToken');
const ExecutorMock = artifacts.require('ExecutorMock');

contract('Controller', (accounts) => {

  // function configure(
  //       address _eurxbToken,
  //       address _initialVault,
  //       address _initialStrategy,
  //       address _initialTreasury,
  //       address _initialStrategist
  // ) external initializer {
  //     _vaults[_eurxbToken] = _initialVault;
  //     _strategies[_eurxbToken] = _initialStrategy;
  //     _treasury = _initialTreasury;
  //     strategist = _initialStrategist;
  // }
  it('should configure properly', async () => {

  });

  // function inCaseTokensGetStuck(address _token, uint256 _amount) onlyGovernanceOrStrategist external {
  //     IERC20(_token).safeTransfer(_msgSender(), _amount);
  // }
  it('should evacuate tokens from controller', async () => {

  });

  // function inCaseStrategyTokenGetStuck(address _strategy, address _token) onlyGovernanceOrStrategist external {
  //     IStrategy(_strategy).withdraw(_token);
  // }
  it('should evacuate all tokens from strategy', async () => {

  });

  // function withdraw(address _token, uint256 _amount) override external {
  //   IStrategy(_strategies[_token]).withdraw(_amount);
  // }
  it('should withdraw tokens from strategy', async () => {

  });

  // function setParts(uint256 _newParts) onlyGovernance external {
  //     require(parts != _newParts, "!old");
  //     parts = _newParts;
  // }
  it('should set pairs', async () => {

  });


  // function setRewards(address _newTreasury) onlyGovernance external {
  //     require(_treasury != _newTreasury, 'old');
  //     _treasury = _newTreasury;
  // }
  it('should set treasury address', async () => {

  });

  // function setOneSplit(address _newOneSplit) onlyGovernance external {
  //     require(_oneSplit != _newOneSplit, 'old');
  //     _oneSplit = _newOneSplit;
  // }
  it('should set one split address', async () => {

  });

  // function setStrategist(address _newStrategist) onlyGovernance external {
  //     require(strategist != _newStrategist, 'old');
  //     strategist = _newStrategist;
  // }
  it('should set strategist address', async () => {

  });

  // function rewards() override external view returns(address) {
  //     return _treasury;
  // }
  it('should get treasury address', async () => {

  });

  // function vaults(address _token) override external view returns(address) {
  //     return _vaults[_token];
  // }
  it('should get vault by token', async () => {

  });

  // function strategies(address _token) override external view returns(address) {
  //     return _strategies[_token];
  // }
  it('should get strategy by token', async () => {

  });

  // function setVault(address _token, address _vault)
  //     override
  //     onlyGovernanceOrStrategist
  //     external
  // {
  //     require(_vaults[_token] == address(0), "!vault 0");
  //     _vaults[_token] = _vault;
  // }
  it('should set vault by token', async () => {

  });

  // function setConverter(
  //     address _input,
  //     address _output,
  //     address _converter
  // ) onlyGovernanceOrStrategist external {
  //     converters[_input][_output] = _converter;
  // }
  it('should set converter address', async () => {

  });

  // function setStrategy(address _token, address _strategy) override onlyGovernanceOrStrategist external {
  //     require(_approvedStrategies[_token][_strategy], "!approved");
  //     address _current = _strategies[_token];
  //     if (_current != address(0)) {
  //         IStrategy(_current).withdrawAll();
  //     }
  //     _strategies[_token] = _strategy;
  // }
  it('should set strategy address', async () => {

  });

  // function setApproveStrategy(address _token, address _strategy, bool _status) onlyGovernance external {
  //     _approvedStrategies[_token][_strategy] = _status;
  // }
  it('should approve strategy address', async () => {

  });

  // function approvedStrategies(address _token, address _strategy) override external view returns(bool) {
  //     return _approvedStrategies[_token][_strategy];
  // }
  it('should get approved strategy address', async () => {

  });

  // function earn(address _token, uint256 _amount) override public {
  //     address _strategy = _strategies[_token];
  //     address _want = IStrategy(_strategy).want();
  //     if (_want != _token) {
  //         address converter = converters[_token][_want];
  //         require(converter != address(0), '!converter');
  //         IERC20(_token).safeTransfer(converter, _amount);
  //         _amount = IConverter(converter).convert(_strategy);
  //         IERC20(_want).safeTransfer(_strategy, _amount);
  //     } else {
  //         IERC20(_token).safeTransfer(_strategy, _amount);
  //     }
  //     IStrategy(_strategy).deposit();
  // }
  it('should send tokens to the strategy and earn', async () => {

  });

  // // Only allows to withdraw non-core strategy tokens ~ this is over and above normal yield
  // function harvest(address _strategy, address _token) override external {
  //     require(_token != _want, "!want");
  //     // This contract should never have value in it, but just incase since this is a public call
  //     uint256 _before = IERC20(_token).balanceOf(address(this));
  //     IStrategy(_strategy).withdraw(_token);
  //     uint256 _after =  IERC20(_token).balanceOf(address(this));
  //     if (_after > _before) {
  //         uint256 _amount = _after.sub(_before);
  //         address _want = IStrategy(_strategy).want();
  //         uint256[] memory _distribution;
  //         uint256 _expected;
  //         _before = IERC20(_want).balanceOf(address(this));
  //         IERC20(_token).safeApprove(_oneSplit, 0);
  //         IERC20(_token).safeApprove(_oneSplit, _amount);
  //         (_expected, _distribution) = IOneSplitAudit(_oneSplit).getExpectedReturn(_token, _want, _amount, parts, 0);
  //         IOneSplitAudit(_oneSplit).swap(_token, _want, _amount, _expected, _distribution, 0);
  //         _after = IERC20(_want).balanceOf(address(this));
  //         if (_after > _before) {
  //             _amount = _after.sub(_before);
  //             uint256 _reward = _amount.mul(split).div(max);
  //             earn(_want, _amount.sub(_reward));
  //             IERC20(_want).safeTransfer(_treasury, _reward);
  //         }
  //     }
  // }
  it('should harvest tokens from the strategy', async () => {

  });

});
