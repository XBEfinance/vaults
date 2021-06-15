#!/bin/bash
export CONFIG_NAME="./truffle-config.js"

./scripts/main_parts_build.sh

if [ -z $1 ]; then
  node -r dotenv/config ./node_modules/.bin/truffle migrate --network rinkeby --skip-dry-run --reset # option key for force re-deploy contracts
else
  node -r dotenv/config ./node_modules/.bin/truffle migrate --network $1 --skip-dry-run --reset # option key for force re-deploy contracts
fi
# remove config file
rm -f $CONFIG_NAME
