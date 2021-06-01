/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { accounts, contract } = require('@openzeppelin/test-environment');
const { strategyTestSuite } = require("./eurxb_strategy_test.js");
const ConsumerEURxbStrategy = contract.fromArtifact("ConsumerEURxbStrategy");
const ConsumerEURxbVault = contract.fromArtifact("ConsumerEURxbVault");
describe('ConsumerEURxbStrategy',
    strategyTestSuite(ConsumerEURxbStrategy, ConsumerEURxbVault)
);
