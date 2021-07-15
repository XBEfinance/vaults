#!/bin/bash

export CONFIG_NAME="./truffle-config.js"
source ./scripts/utils/generate_truffle_config.sh

generate_truffle_config "0.6.6" ".\/contracts"

node ./node_modules/.bin/truffle console $@

# remove config file
rm -f $CONFIG_NAME
