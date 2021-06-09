/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { accounts, contract } = require('@openzeppelin/test-environment');
const { strategyTestSuite } = require("./eurxb_strategy_test.js");
const InstitutionalEURxbStrategy = contract.fromArtifact("InstitutionalEURxbStrategy");
const InstitutionalEURxbVault = contract.fromArtifact("InstitutionalEURxbVault");
describe('InstitutionalEURxbStrategy',
    strategyTestSuite(InstitutionalEURxbStrategy, InstitutionalEURxbVault, true)
);
