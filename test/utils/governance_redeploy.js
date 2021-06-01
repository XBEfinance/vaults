const { ether } = require('@openzeppelin/test-helpers');
const { accounts, contract } = require('@openzeppelin/test-environment');
const { getMockTokenPrepared } = require('./common.js');

const Governance = contract.fromArtifact('Governance');
const GovernanceToken = contract.fromArtifact('XBE');
const MockToken = contract.fromArtifact('MockToken');

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
    startId,
    governanceTokenTotalSupply,
    governance,
    rewardDistribution,
    rewardsTokenTotalSupply,
    mintTo,
    mockedAmount,
    from
) => {
  const [ owner ] = accounts;
  const governanceContract = await Governance.new({ from: owner });
  const rewardsToken = await getMockTokenPrepared(mintTo, mockedAmount, rewardsTokenTotalSupply, from);
  const governanceToken = await GovernanceToken.new(governanceTokenTotalSupply, { from: owner });
  await governanceContract.configure(
    startId,
    rewardsToken.address,
    governance,
    governanceToken.address,
    rewardDistribution,
    { from: owner }
  );
  return [ governanceContract, governanceToken, rewardsToken ];
}

module.exports = {
  actorStake, activeActor, deployAndConfigureGovernance
}
