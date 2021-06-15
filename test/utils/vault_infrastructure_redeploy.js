const { constants } = require('@openzeppelin/test-helpers');
const { accounts, contract } = require('@openzeppelin/test-environment');
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
  oneSplitAddress,
  governanceContract
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
  const [owner] = accounts;
  const mock = await MockContract.new({ from: owner});

  const controller = await Controller.new({ from: owner});
  const strategy = await strategyType.new({ from: owner});
  const vault = await vaultType.new({ from: owner});
  const treasury = await Treasury.new({ from: owner});
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

module.exports = { vaultInfrastructureRedeploy };
