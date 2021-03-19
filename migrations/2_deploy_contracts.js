const Treasury = artifacts.require('Treasury');
const Governance = artifacts.require('Governance');
const XBE = artifacts.require('XBE');

// const usd = (n) => web3.utils.toWei(n, 'Mwei');
// const ether = (n) => web3.utils.toWei(n, 'ether');
//
module.exports = function (deployer, network) {
  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network.startsWith('rinkeby')) {
      const xbe = await XBE.at('0xfaC2D38F064A35b5C0636a7eDB4B6Cc13bD8D278');
      const governance = await deployer.deploy(Governance);
      await governance.configure(
        '0',
        xbe.address, // Reward token
        process.env.RINKEBY_OWNER_ACCOUNT,
        xbe.address, // Governance token
        process.env.REWARD_DISTRIBUTION_RINKEBY_ACCOUNT,
      );

      const treasury = await deployer.deploy(Treasury);
      await treasury.configure(
        process.env.RINKEBY_OWNER_ACCOUNT,
        '0x0000000000000000000000000000000000000000', // testnet OneSplit account
        governance.address,
        xbe.address, // Reward token
      );
    }
  });
};
