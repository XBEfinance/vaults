const { constants } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const ConsumerEURxbVault = artifacts.require("ConsumerEURxbVault");
const Treasury = artifacts.require("Treasury");

const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const Controller = artifacts.require("Controller");
const IERC20 = artifacts.require("ERC20");
const MockContract = artifacts.require("MockContract");

const configureMainParts = async (
  strategy,
  controller,
  revenueToken,
  vault,
  treasury,
  governance,
  strategist,
  oneSplitAddress,
  governanceContract
) => {
  await strategy.configure(
    revenueToken.address,
    controller.address,
    vault.address,
    {from: governance}
  );

  await controller.configure(
    treasury.address,
    strategist,
    {from: governance}
  );

  await controller.setVault(
    revenueToken.address,
    vault.address,
    {from: governance}
  );

  await controller.setApprovedStrategy(
    revenueToken.address,
    strategy.address,
    true,
    {from: governance}
  );

  await controller.setStrategy(
    revenueToken.address,
    strategy.address,
    {from: governance}
  );

  await treasury.configure(
    governance,
    oneSplitAddress,
    governanceContract.address,
    revenueToken.address,
    {from: governance}
  );
}

const vaultInfrastructureRedeploy = async (
  governance,
  strategist,
  strategyType,
  vaultType
) => {
  const mock = await MockContract.new();

  const controller = await Controller.new();
  const strategy = await strategyType.new();
  const vault = await vaultType.new();
  const treasury = await Treasury.new();
  var revenueToken = await IERC20.at(mock.address);

  var treasuryAddress = treasury.address;

  await configureMainParts(
    strategy,
    controller,
    revenueToken,
    vault,
    treasury,
    governance,
    strategist,
    mock.address,
    mock
  );

  return [ mock, controller, strategy, vault, revenueToken, treasury ]
};

const vaultInfrastructureRedeployWithRevenueToken = async (
  governance,
  strategist,
  strategyType,
  vaultType,
  revenueToken
) => {
  const mock = await MockContract.new();

  const controller = await Controller.new();
  const strategy = await strategyType.new();
  const vault = await vaultType.new();
  const treasury = await Treasury.new();

  var treasuryAddress = treasury.address;

  await configureMainParts(
    strategy,
    controller,
    revenueToken,
    vault,
    treasury,
    governance,
    strategist,
    mock.address,
    mock
  );

  return [ mock, controller, strategy, vault, revenueToken, treasury ]
};

module.exports = { vaultInfrastructureRedeploy, vaultInfrastructureRedeployWithRevenueToken };
