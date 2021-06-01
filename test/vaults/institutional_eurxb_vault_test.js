/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { contract } = require('@openzeppelin/test-environment');

const { vaultTestSuite } = require('./eurxb_vault_test');
const InstitutionalEURxbStrategy = contract.fromArtifact("InstitutionalEURxbStrategy");
const InstitutionalEURxbVault = contract.fromArtifact("InstitutionalEURxbVault");
describe('InstitutionalEURxbVault',
  vaultTestSuite(InstitutionalEURxbStrategy, InstitutionalEURxbVault)
);
