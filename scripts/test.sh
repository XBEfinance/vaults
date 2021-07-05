#!/bin/bash

export CONFIG_NAME="./truffle-config.js"
source ./scripts/utils/generate_truffle_config.sh

if [[ $1 = "+fast" ]]; then
  echo "Run tests without build!"
  generate_truffle_config "0.6.3" ".\/contracts"
  #remove +fast parameter
  shift
else
  # remove previous build
  rm -rf ./build
  ./scripts/main_parts_build.sh
fi

cp -r ./abi/* ./build/contracts/
echo "Third party artifacts copied!"

if [[ $1 = "+network" ]]; then
  # run tests
  truffle test --network $2 --compile-none --stacktrace $@
else
  if [[ $1 = "+debug" ]]; then
    node --inspect ./node_modules/.bin/truffle test --compile-none --stacktrace $@
  else
    # run tests
    truffle test --compile-none --stacktrace $@
  fi
fi


# remove config file
rm -f $CONFIG_NAME
