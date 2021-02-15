const { ether } = require('@openzeppelin/test-helpers');

const Governance = artifacts.require('Governance');
const GovernanceToken = artifacts.require('XBG');
const MockToken = artifacts.require('MockToken');

const actorStake = async (address, sum, governanceContract, governanceToken) => {
  await governanceToken.approve(governanceContract.address, sum, {from: address});
  await governanceContract.stake(sum, {from: address});
};

const activeActor = async (address, sum, governanceContract, governanceToken, governance) => {
  await governanceToken.approve(address, sum, {from: governance});
  await governanceToken.transfer(address, sum, {from: governance});
  await governanceContract.register({from: address});
};

const deployAndConfigureGovernance = async (
    stardId,
    initialTotalSupply,
    governance
) => {
  const governanceContract = await Governance.new();
  const stakingRewardsToken = await MockToken.new('Mock Token', 'MT', ether('123'));
  const governanceToken = await GovernanceToken.new(initialTotalSupply);
  await governanceContract.configure(
    stardId,
    stakingRewardsToken.address,
    governance,
    governanceToken.address
  );
  return [ governanceContract, governanceToken, stakingRewardsToken ];
}

module.exports = {
  actorStake, activeActor, deployAndConfigureGovernance
}
