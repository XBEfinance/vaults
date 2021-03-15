#!/bin/bash

export CONFIG_NAME="./truffle-config.js"
source ./scripts/utils/generate_truffle_config.sh

# remove previous build
rm -rf ./build

mkdir -p build/contracts/

# build third party contracts
./scripts/third_party_build.sh

# generate truffle config for coverage
generate_truffle_config "0.6.3" ".\/contracts"

#run coverage
node --max-old-space-size=4096 ./node_modules/.bin/truffle run coverage

# remove build
rm -rf ./build

# remove config file
rm -f $CONFIG_NAME