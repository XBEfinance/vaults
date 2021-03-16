const { BN, ether, expectRevert } = require('@openzeppelin/test-helpers');

const MockToken = artifacts.require("MockToken");

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

const getMockTokenPrepared = async (mintTo, mockedAmount, totalSupply, from) => {
  const mockToken = await MockToken.new('Mock Token', 'MT', totalSupply, {from: from});
  if (mintTo !== from) {
    await mockToken.approve(mintTo, mockedAmount, {from});
    await mockToken.transfer(mintTo, mockedAmount, {from});
  }
  return mockToken;
};

const processEventArgs = async (result, eventName, processArgs) => {
  if (result == null) {
    throw new Error(`Result of tx is: ${result}`);
  }
  const filteredLogs = result.logs.filter(l => l.event === eventName);
  const eventArgs = filteredLogs[0].args;
  await processArgs(eventArgs);
};

const checkSetter = async (
  setterMethodName,
  getterName,
  newValue,
  validSender,
  nonValidSender,
  contractInstance,
  revertMessage
) => {
  await contractInstance[setterMethodName](newValue, {from: validSender});
  expect(await contractInstance[getterName]()).to.be.equal(newValue);
  await expectRevert(contractInstance[setterMethodName](newValue, {from: nonValidSender}), revertMessage);
}

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
  getMockTokenPrepared,
  processEventArgs,
  checkSetter
};
