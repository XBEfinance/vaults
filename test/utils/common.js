const { BN } = require('@openzeppelin/test-helpers');
const constants = require('./constants.js');
const artifacts = require('./artifacts.js');

const revertToSnapShot = (id) => new Promise((resolve, reject) => {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_revert',
    params: [id],
    id: new Date().getTime(),
  }, (err, result) => {
    if (err) { return reject(err); }
    return resolve(result);
  });
});

const takeSnapshot = () => new Promise((resolve, reject) => {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_snapshot',
    id: new Date().getTime(),
  }, (err, snapshotId) => {
    if (err) { return reject(err); }
    return resolve(snapshotId);
  });
});

const getMockTokenPrepared = async (mintTo, mockedAmount, totalSupply, from) => {
  const mockToken = await artifacts.MockToken.new('Mock Token', 'MT', totalSupply, { from });

  if (mintTo !== from) {
    await mockToken.approve(mintTo, mockedAmount, { from });
    await mockToken.transfer(mintTo, mockedAmount, { from });
  }

  return mockToken;
};

const processEventArgs = async (result, eventName, processArgs) => {
  if (result == null) {
    throw new Error(`Result of tx is: ${result}`);
  }
  const filteredLogs = result.logs.filter((l) => l.event === eventName);
  const eventArgs = filteredLogs[0].args;
  await processArgs(eventArgs);
};

const overrideConfigureArgsIfNeeded = async (
  originalConfigureParams,
  overridenConfigureParams,
  // originalConfigureParamsLength,
) => {
  const result = [];
  const length = originalConfigureParams.length;
  const overrideDefined = (typeof overridenConfigureParams) !== 'undefined';
  for (let i = 0; i < length; i += 1) {
    result.push(overrideDefined && overridenConfigureParams[i]
      // eslint-disable-next-line no-await-in-loop
      ? overridenConfigureParams[i] : await originalConfigureParams[i]());
  }
  return result;
};

const checkSetter = async (
  setterMethodName,
  getterName,
  newValue,
  validSender,
  nonValidSender,
  contractInstance,
  revertMessage,
  expect,
  expectRevert,
) => {
  await contractInstance[setterMethodName](newValue, { from: validSender });
  if (newValue instanceof BN) {
    expect(await contractInstance[getterName]()).to.be.bignumber.equal(newValue);
  } else {
    expect(await contractInstance[getterName]()).to.be.equal(newValue);
  }
  await expectRevert(
    contractInstance[setterMethodName](newValue, { from: nonValidSender }),
    revertMessage,
  );
};

const waitFor = (key, container, logMetadata) => new Promise((resolve) => {
  const timeId = setInterval(() => {
    if (key in container) {
      clearInterval(timeId);
      resolve(container[key]);
      if (logMetadata) {
        console.log(`Found ${key}! - ${logMetadata}`);
      } else {
        console.log(`Found ${key}!`);
      }
     } else {
      if (logMetadata) {
        console.log(`Waiting for ${key}... - ${logMetadata}`);
      } else {
        console.log(`Waiting for ${key}...`);
      }
    }
  }, constants.waitingForPollingInterval);
});

const cacheAndReturnContract = async (key, force, container, isMockContractRequested, getInstance) => {
    if (key in container && !force) {
      return container[key];
    }
    let instance;
    if (isMockContractRequested) {
      instance = await artifacts.MockContract.new();
    } else {
      instance = await getInstance();;
    }
    container[key] = instance;
    return instance;
}

const cacheAndReturn = async (key, force, container, getInstance) => {
  if (key in container && !force) {
    return container[key];
  }
  const instance = await getInstance();
  container[key] = instance;
  return instance;
};

const days = (n) => new BN('60').mul(new BN('1440').mul(new BN(n)));
const months = (n) => days('30').mul(new BN(n));
const getNowBN = () => new BN(Date.now() / 1000);

module.exports = {
  getMockTokenPrepared,
  processEventArgs,
  checkSetter,
  revertToSnapShot,
  takeSnapshot,
  days,
  months,
  waitFor,
  getNowBN,
  cacheAndReturn,
  overrideConfigureArgsIfNeeded,
  cacheAndReturnContract
};
