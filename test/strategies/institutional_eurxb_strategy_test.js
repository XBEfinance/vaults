/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { strategyTestSuite } = require("./eurxb_strategy_test.js");
const InstitutionalEURxbStrategy = artifacts.require("InstitutionalEURxbStrategy");
const InstitutionalEURxbVault = artifacts.require("InstitutionalEURxbVault");
contract('InstitutionalEURxbStrategy',
    strategyTestSuite(InstitutionalEURxbStrategy, InstitutionalEURxbVault)
);
