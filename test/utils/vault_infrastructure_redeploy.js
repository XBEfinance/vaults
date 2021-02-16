const { constants } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const Controller = artifacts.require("Controller");
const ERC20 = artifacts.require("ERC20");
const MockContract = artifacts.require("MockContract");

const vaultInfrastructureRedeploy = async (
  governance,
  strategist
) => {
  const mock = await MockContract.new();
  const controller = await Controller.new();
  const strategy = await InstitutionalEURxbStrategy.new();
  const vault = await InstitutionalEURxbVault.new();
  var revenueToken = await ERC20.at(mock.address);
  var treasuryAddress = vault.address;

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

  return [ mock, controller, strategy, vault, revenueToken ]
};

module.exports = { vaultInfrastructureRedeploy };
