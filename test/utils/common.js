const { BN, ether } = require('@openzeppelin/test-helpers');

/* eslint-disable */
function increaseTime(duration) {
  const id = Date.now();
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id,
    }, (err1) => {
      if (err1) {
        return reject(err1);
      }
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
}
/* eslint-enable */

async function currentTimestamp() {
  const timestamp = Date.now();
  return Math.trunc(timestamp / 1000);
}

/* eslint-disable */
const compactView = value_BN => web3.utils.fromWei(value_BN.toString(), 'ether');
const Ether = value_str => new BN(web3.utils.toWei(value_str, 'ether'));
const newBN = (value_str = '1.0') => new BN(web3.utils.toWei(value_str, 'ether'));
/* eslint-enable */

const getMockTokenPrepared = async (mintTo, mockedAmount, from) => {
  const mockToken = await MockToken.new('Mock Token', 'MT', ether('123'), {from: miris});
  await mockToken.approve(mintTo, mockedAmount, {from});
  await mockToken.transfer(mintTo, mockedAmount, {from});
  return mockToken;
};

module.exports = {
  increaseTime,
  currentTimestamp,
  compactView,
  Ether,
  newBN,
  DAY: 86400,
  HOUR: 3600,
  ZERO: new BN('0'),
  ONE: new BN('1'),
  CONVERSION_WEI_CONSTANT: ether('1'),
  getMockTokenPrepared
};
