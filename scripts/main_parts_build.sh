#!/bin/bash

source ./scripts/utils/generate_truffle_config.sh

# build third party contracts
./scripts/third_party_build.sh

# build our contracts
generate_truffle_config "0.4.24" ".\/contracts\/governance"
node --stack-size=1200 ./node_modules/.bin/truffle compile

generate_truffle_config "0.6.6" ".\/contracts\/main"
truffle compile
