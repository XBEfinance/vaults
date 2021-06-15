#!/bin/bash
export CONFIG_NAME="./truffle-config.js"
source ./scripts/utils/generate_truffle_config.sh

generate_truffle_config "0.6.3" ".\/contracts"

function verifyAll {
  truffle run verify Voting --network $1
  truffle run verify BonusCampaign --network $1
  truffle run verify VeXBE --network $1
  truffle run verify XBEInflation --network $1
  
  truffle run verify Bank --network $1
  truffle run verify BankProxyAdmin --network $1
  truffle run verify BankTransparentProxy --network $1
}

if [ -z $1 ]; then
  verifyAll rinkeby
else
  if [ -z $2 ]; then
    truffle run verify $1 --network rinkeby
  else
    if [[ $1 = "all" ]]; then
      verifyAll $2
    else
      truffle run verify $1 --network $2
    fi
  fi
fi

# remove config file
rm -f $CONFIG_NAME
