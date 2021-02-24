const { constants } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const ConsumerEURxbVault = artifacts.require("ConsumerEURxbVault");

const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const Controller = artifacts.require("Controller");
const IERC20 = artifacts.require("ERC20");
const MockContract = artifacts.require("MockContract");
const TokenProxyFactory = artifacts.require("TokenProxyFactory");

const configureMainParts = async (
  strategy,
  controller,
  revenueToken,
  vault,
  treasuryAddress,
  governance,
  strategist
) => {
  await strategy.configure(
    revenueToken.address,
    controller.address,
    vault.address,
    {from: governance}
  );

  await controller.configure(
    treasuryAddress,
    strategist,
    {from: governance}
  );

  await vault.configure(
    revenueToken.address,
    controller.address,
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
}

const vaultInfrastructureRedeploy = async (
  governance,
  strategist,
  useTokenProxy
) => {
  const mock = await MockContract.new();

  const controller = await Controller.new();
  const strategy = await InstitutionalEURxbStrategy.new();
  var vault;
  if (!useTokenProxy) {
    vault = await InstitutionalEURxbVault.new();
  } else {
    vault = await ConsumerEURxbVault.new();
  }
  var revenueToken = await IERC20.at(mock.address);

  // TODO: it's a temporal address, change it when treasury contract is ready
  var treasuryAddress = vault.address;

  await configureMainParts(
    strategy,
    controller,
    revenueToken,
    vault,
    treasuryAddress,
    governance,
    strategist
  );

  if (useTokenProxy) {
    const tokenProxyFactory = await TokenProxyFactory.new();
    await tokenProxyFactory.configure(revenueToken.address);
    return [ mock, controller, strategy, vault, revenueToken, tokenProxyFactory ]
  } else {
    return [ mock, controller, strategy, vault, revenueToken ]
  }
};

module.exports = { vaultInfrastructureRedeploy };
