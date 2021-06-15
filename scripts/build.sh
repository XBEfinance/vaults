#!/bin/bash

export CONFIG_NAME="./truffle-config.js"

# remove previous build
rm -rf ./build

./scripts/main_parts_build.sh

# remove config file
rm -f $CONFIG_NAME
