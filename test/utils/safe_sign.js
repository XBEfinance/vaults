const baseGasValue = (hexValue) => {
  switch(hexValue) {
    case "0x": return 0;
    case "00": return 4;
    default: return 68;
  };
}

const estimatebaseGasCosts = (dataString) => {
  const reducer = (accumulator, currentValue) => accumulator += baseGasValue(currentValue)
  return dataString.match(/.{2}/g).reduce(reducer, 0)
}

const estimateBaseGas = (safe, to, value, data, operation, txGasEstimate, gasToken, refundReceiver, signatureCount, nonce) => {
  // numbers < 256 are 192 -> 31 * 4 + 68
  // numbers < 65k are 256 -> 30 * 4 + 2 * 68
  // For signature array length and baseGasEstimate we already calculated the 0 bytes so we just add 64 for each non-zero byte
  var signatureCost = signatureCount * (68 + 2176 + 2176 + 6000); // (array count (3 -> r, s, v) + ecrecover costs) * signature count
  var payload = safe.contract.execTransaction.getData(
      to, value, data, operation, txGasEstimate, 0, GAS_PRICE, gasToken, refundReceiver, "0x"
  );
  var baseGasEstimate = estimatebaseGasCosts(payload) + signatureCost + (nonce > 0 ? 5000 : 20000) + 1500; // 1500 -> hash generation costs
  return baseGasEstimate + 32000; // Add aditional gas costs (e.g. base tx costs, transfer costs)
}

const logGasUsage = (subject, transactionOrReceipt) => {
  var receipt = transactionOrReceipt.receipt || transactionOrReceipt;
  console.log("    Gas costs for " + subject + ": " + receipt.gasUsed);
}

const checkTxEvent = (transaction, eventName, contract, exists, subject) => {
  assert.isObject(transaction)
  if (subject && subject != null) {
      logGasUsage(subject, transaction);
  }
  let logs = transaction.logs;
  if(eventName != null) {
      logs = logs.filter((l) => l.event === eventName && l.address === contract);
  }
  assert.equal(logs.length, exists ? 1 : 0, exists ? 'event was not present' : 'event should not be present');
  return exists ? logs[0] : null;
}

var executeTransactionWithSigner = async (signer, safe, subject, accounts, to, value, data, operation, executor, opts) => {
  var options = opts || {};
  var txFailed = options.fails || false;
  var txGasToken = options.gasToken || 0;
  var refundReceiver = options.refundReceiver || 0;

  // Estimate safe transaction (need to be called with from set to the safe address)
  var txGasEstimate = 0;
  try {
    var estimateData = safe.contract.requiredTxGas.getData(to, value, data, operation);
    var estimateResponse = await web3.eth.call({to: safe.address, from: safe.address, data: estimateData, gasPrice: 0});
    txGasEstimate = new BigNumber(estimateResponse.substring(138), 16);
    // Add 10k else we will fail in case of nested calls
    txGasEstimate = txGasEstimate.toNumber() + 10000;
    console.log("    Tx Gas estimate: " + txGasEstimate);
  } catch(e) {
    console.log("    Could not estimate " + subject + "; cause: " + e);
  }
  var nonce = await safe.nonce();

  var baseGasEstimate = estimateBaseGas(safe, to, value, data, operation, txGasEstimate, txGasToken, refundReceiver, accounts.length, nonce);
  console.log("    Base Gas estimate: " + baseGasEstimate);

  var gasPrice = GAS_PRICE;
  if (txGasToken != 0) {
    gasPrice = 1;
  }
  gasPrice = options.gasPrice || gasPrice;

  var sigs = await signer(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce);

  var payload = safe.contract.execTransaction.getData(
    to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, sigs
  );
  console.log("    Data costs: " + estimatebaseGasCosts(payload));

  // Estimate gas of paying transaction
  var estimate = null;
  try {
    estimate = await safe.execTransaction.estimateGas(
      to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, sigs
    );
  } catch (e) {
      if (options.revertMessage == undefined ||options.revertMessage == null) {
        throw e;
      }
      assert.equal(("VM Exception while processing transaction: revert " + opts.revertMessage).trim(), e.message);
      return null;
  }

  // Execute paying transaction
  // We add the txGasEstimate and an additional 10k to the estimate to ensure that there is enough gas for the safe transaction
  var tx = await safe.execTransaction(
      to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, sigs, {from: executor, gas: estimate + txGasEstimate + 10000, gasPrice: gasPrice}
  );
  var events = utils.checkTxEvent(tx, 'ExecutionFailed', safe.address, txFailed, subject);
  if (txFailed) {
      var transactionHash = await safe.getTransactionHash(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce);
      assert.equal(transactionHash, events.args.txHash);
  }
  return tx;
}

const signTypedData = async (account, data) => {
    return new Promise(function (resolve, reject) {
        web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: "eth_signTypedData",
            params: [account, data],
            id: new Date().getTime()
        }, function(err, response) {
            if (err) {
                return reject(err);
            }
            resolve(response.result);
        });
    });
}

const signer = async (confirmingAccounts, safeAddress, to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce) => {
  const typedData = {
    types: {
      EIP712Domain: [
        { type: "address", name: "verifyingContract" }
      ],
      // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
      SafeTx: [
          { type: "address", name: "to" },
          { type: "uint256", name: "value" },
          { type: "bytes", name: "data" },
          { type: "uint8", name: "operation" },
          { type: "uint256", name: "safeTxGas" },
          { type: "uint256", name: "baseGas" },
          { type: "uint256", name: "gasPrice" },
          { type: "address", name: "gasToken" },
          { type: "address", name: "refundReceiver" },
          { type: "uint256", name: "nonce" },
      ]
    },
    domain: {
      verifyingContract: safeAddress
    },
    primaryType: "SafeTx",
    message: {
      to: to,
      value: value,
      data: data,
      operation: operation,
      safeTxGas: txGasEstimate,
      baseGas: baseGasEstimate,
      gasPrice: gasPrice,
      gasToken: txGasToken,
      refundReceiver: refundReceiver,
      nonce: nonce.toNumber()
    }
  };
  var signatureBytes = "0x";
  confirmingAccounts.sort();
  for (var i = 0; i < confirmingAccounts.length; i++) {
      signatureBytes += (await signTypedData(confirmingAccounts[i], typedData)).replace('0x', '');
  }
  return signatureBytes;
}

module.exports = {
  signTypedData,
  signBy
};
