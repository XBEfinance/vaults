/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { vaultTestSuite } = require('./eurxb_vault_test');
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
contract('InstitutionalEURxbVault',
  vaultTestSuite(InstitutionalEURxbStrategy, InstitutionalEURxbVault)
);
