const { ether } = require('@openzeppelin/test-helpers');
const { getMockTokenPrepared } = require('./common.js');

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
    governanceTokenTotalSupply,
    governance,
    rewardDistribution,
    rewardsTokenTotalSupply,
    mintTo,
    mockedAmount,
    from
) => {
  const governanceContract = await Governance.new();
  const rewardsToken = await getMockTokenPrepared(mintTo, mockedAmount, rewardsTokenTotalSupply, from);
  const governanceToken = await GovernanceToken.new(governanceTokenTotalSupply);
  await governanceContract.configure(
    stardId,
    rewardsToken.address,
    governance,
    governanceToken.address,
    rewardDistribution
  );
  return [ governanceContract, governanceToken, rewardsToken ];
}

module.exports = {
  actorStake, activeActor, deployAndConfigureGovernance
}
