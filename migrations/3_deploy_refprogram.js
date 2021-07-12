/* eslint-disable no-await-in-loop */
const { BN } = require('@openzeppelin/test-helpers');

const ether = (n) => new BN(web3.utils.toWei(n, 'ether'));

const ReferralProgram = artifacts.require('ReferralProgram');
const MockToken = artifacts.require('MockToken');

module.exports = function (deployer, network, accounts) {
  const owner = accounts[0];

  deployer.then(async () => {
    if (network.startsWith('rinkeby')) {
      const tokens = [];
      for (let i = 0; i < 3; i += 1) {
        const mockToken = await deployer.deploy(
          MockToken,
          `Mock Token ${i}`,
          `mTKN${i}`,
          ether('2000'),
        );
        tokens.push(mockToken.address);
      }
      const referralProgram = await deployer.deploy(ReferralProgram);
      await referralProgram.configure(tokens, owner);
    }
  });
};
