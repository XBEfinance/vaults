const { accounts, contract } = require('@openzeppelin/test-environment');

const Migrations = contract.fromArtifact('Migrations');

module.exports = function(deployer) {
  deployer.deploy(Migrations, { from: accounts[0] });
};
