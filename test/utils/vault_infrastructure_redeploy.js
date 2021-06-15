const { constants } = require('@openzeppelin/test-helpers');
const { accounts, contract } = require('@openzeppelin/test-environment');
const {
  deployStrategyInfrastructure,
  defaultParams,
  getMockCXandXBE
} = require("./deploy_strategy_infrastructure.js");

const { ZERO_ADDRESS } = constants;

const InstitutionalEURxbVault = contract.fromArtifact("InstitutionalEURxbVault");
const ConsumerEURxbVault = contract.fromArtifact("ConsumerEURxbVault");
const Treasury = contract.fromArtifact("Treasury");

const InstitutionalEURxbStrategy = contract.fromArtifact("InstitutionalEURxbStrategy");
const Controller = contract.fromArtifact("Controller");
const IERC20 = contract.fromArtifact("ERC20");
const MockContract = contract.fromArtifact("MockContract");

const configureMainParts = async (
  strategy,
  controller,
  revenueToken,
  vault,
  treasury,
  governance,
  strategist,
  oneSplitAddress
) => {
  await strategy.configure(
    revenueToken.address,
    controller.address,
    vault.address
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
    strategy.address,
    revenueToken.address,
    {from: governance}
  );
}

const vaultInfrastructureRedeploy = async (
  governance,
  strategist,
  strategyType,
  vaultType,
  params
) => {
  const [owner, alice, bob] = accounts;
  const mock = await MockContract.new({ from: owner});

  const controller = await Controller.new({ from: owner});
  const strategy = await strategyType.new({ from: owner});
  const vault = await vaultType.new({ from: owner});
  const treasury = await Treasury.new({ from: owner});

  const [mockXBE, mockCX] = await getMockXBEandCX(owner, alice, bob, params);

  await configureMainParts(
    strategy,
    controller,
    mockXBE.address,
    vault,
    treasury,
    governance,
    strategist,
    mock.address
  );

  const strategyInfrastructureDeployment = deployStrategyInfrastructure(
    owner, alice, bob, strategy, mockXBE, mockCX, params
  );

  return [
    mock,
    controller,
    strategy,
    vault,
    revenueToken,
    treasury,
    strategyInfrastructureDeployment
  ]
};

module.exports = { vaultInfrastructureRedeploy };
