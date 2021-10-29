/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const common = require('./utils/common');
const utilsConstants = require('./utils/constants');
const artifacts = require('./utils/artifacts');
const environment = require('./utils/environment');
const { people, setPeople } = require('./utils/accounts');

let uniswapRouter;
let treasury;
let rewardsToken;
let mockXBE;
let mockCRV;
let mockCVX;
let feeToTreasuryTransporter;

contract('FeeToTreasuryTransporter', (accounts) => {
  setPeople(accounts);

  beforeEach(async () => {
    [
      uniswapRouter,
      mockXBE,
      mockCRV,
      mockCVX,
      treasury,
      feeToTreasuryTransporter
    ] = await environment.getGroup(
      [
        'MockContract',
        'MockXBE',
        'MockCRV',
        'MockCVX',
        'Treasury',
        'FeeToTreasuryTransporter'
      ],
      (_) => true,
      true,
      null,
      {
        "FeeToTreasuryTransporter": true
      }
    );
  });

  it('should convert all tokens to XBE and send them to treasury', async () => {

  });

});
