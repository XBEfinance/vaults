#!/bin/bash
export CONFIG_NAME="./truffle-config.js"

source ./scripts/utils/generate_truffle_config.sh

if [[ $1 = "+fast" ]]; then
  echo "Run deploy without build!"
  generate_truffle_config "0.6.3" ".\/contracts"
  #remove +fast parameter
  shift
else
  # remove previous build
  rm -rf ./build
  ./scripts/main_parts_build.sh

  cp -r ./abi/* ./build/contracts/
  echo "Third party artifacts copied!"
fi

if [ -z $1 ]; then
  node -r dotenv/config ./node_modules/.bin/truffle migrate --network rinkeby --skip-dry-run --reset # option key for force re-deploy contracts
else
  node -r dotenv/config ./node_modules/.bin/truffle migrate --network $1 --skip-dry-run --reset # option key for force re-deploy contracts
fi

# remove config file
rm -f $CONFIG_NAME
