/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { vaultTestSuite } = require('./eurxb_vault_test');
const ConsumerEURxbStrategy = artifacts.require("ConsumerEURxbStrategy");
const ConsumerEURxbVault = artifacts.require("ConsumerEURxbVault");
contract('ConsumerEURxbVault',
  vaultTestSuite(ConsumerEURxbStrategy, ConsumerEURxbVault)
);