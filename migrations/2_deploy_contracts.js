const { BN } = require('@openzeppelin/test-helpers');

const Vault = artifacts.require('Vault');
const HiveStrategy = artifacts.require('HiveStrategy');
const Controller = artifacts.require('Controller');
const ReferralProgram = artifacts.require('ReferralProgram');

const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));

module.exports = function (deployer, network) {
  const owner = process.env.DEPLOYER_ACCOUNT;
  deployer.then(async () => {
    if (network.startsWith('mainnet')) {
      if (network === 'mainnet_deploy' || network === 'mainnet_deploy-fork') {
        const tokenAddress = '0x5282a4ef67d9c33135340fb3289cc1711c13638c';
        const xbeAddress = '0x5DE7Cc4BcBCa31c473F6D2F27825Cfb09cc0Bb16';
        const votingStakingRewardsAddress = '0x0b1fA4b11Edbcb6d35731549211D83C857fFBC0a';
        const treasuryAddress = '0x76dD31e70f0337633DEc8a066618c533e4172951';
        const registryAddress = '0x108932809664D1DAd4a0Cf8f2c8692B42Ca455dB';
        const controller = await Controller.at('0x9DAfB34D92017b3A52a06Efd4350cB4Fe5a83F88');
        const crvAddress = '0xD533a949740bb3306d119CC777fa900bA034cd52';
        const cvxAddress = '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B';
        const cvxCrvAddress = '0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7';
        const cvxRewardsAddress = '0xCF50b810E57Ac33B91dCF525C6ddd9881B139332';
        const poolCvxRewardsAddress = '0x3E03fFF82F77073cc590b656D42FceB12E4910A8';
        const convexBoosterAddress = '0xF403C135812408BFbE8713b5A23a04b3D48AAE31';
        const name = 'ironbank';
        const vault = await Vault.at('0x1FF4DCd01f27Ce8E09CB0648BC415072A16D21f4');
        // const vault = await deployer.deploy(Vault, 'XBE Hive Curve LP', 'xh', { from: owner });
        // console.log(`vault deployed. Address: `, vault.address);
        const strategy = await HiveStrategy.at('0xDA212d6f2cc78850f09038041CC25FE3b14cea6a');
        // const strategy = await deployer.deploy(HiveStrategy, { from: owner });
        // console.log(`strategy deployed. Address: `, strategy.address);
        const referralProgram = await ReferralProgram.at('0x78675E65dD456b418bAfdF666091eEc1787e2D83');
        // const referralProgram = await deployer.deploy(ReferralProgram, { from: owner });
        // console.log(`referralProgram deployed. Address: `, referralProgram.address);
        console.log(`Configuring ${name}...`);
        await controller.setVault(
          tokenAddress,
          vault.address,
          {from: owner},
        );
        console.log('Controller: vault added...');

        await controller.setApprovedStrategy(
          tokenAddress,
          strategy.address,
          true,
          {from: owner},
        );
        console.log('Controller: strategy approved...');

        await controller.setStrategy(
          tokenAddress,
          strategy.address,
          {from: owner},
        );
        console.log('Controller: strategy added...');

        await strategy.configure(
          tokenAddress,
          controller.address,
          owner,
          [
            poolCvxRewardsAddress,
            cvxRewardsAddress,
            convexBoosterAddress,
            29,
          ],
          {from: owner},
        );
        console.log(`${name}Strategy: configured`);

        vault.configure(
          tokenAddress,
          controller.address,
          owner,
          days('7'),
          xbeAddress,
          votingStakingRewardsAddress,
          true,
          owner,
          referralProgram.address,
          treasuryAddress,
          [ // _rewardTokens
            crvAddress,
            cvxAddress,
            xbeAddress,
          ],
          'ironbank',
          'ironbank',
          {from: owner},
        );
        console.log(`${name}Vault: configured`);

        await vault.setRewardsDistribution(
          strategy.address,
          {from: owner},
        );
        console.log(`${name}Vault: setRewardsDistribution`);

        await referralProgram.configure(
          [
            xbeAddress,
            cvxAddress,
            cvxCrvAddress,
          ],
          treasuryAddress,
          registryAddress,
          { from: owner },
        );

        // await registry.addVault(
        //   item.vault.address,
        //   {from: owner},
        // );
        // console.log(`${item.name}Vault: add to registry`);

        console.log('All vaults and strategies have been configured...');
      } else {
        console.error(`Unsupported network: ${network}`);
      }
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
