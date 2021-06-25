#!/bin/bash

# Compile Gnosis Mock Contract
source ./scripts/utils/generate_truffle_config.sh
generate_truffle_config "0.6.6" ".\/node_modules\/@gnosis.pm\/mock-contract\/contracts"
truffle compile

source ./scripts/utils/generate_truffle_config.sh
generate_truffle_config "0.5.16" ".\/node_modules\/@uniswap\/v2-core\/contracts"
truffle compile

source ./scripts/utils/generate_truffle_config.sh
generate_truffle_config "0.6.6" ".\/node_modules\/@uniswap\/v2-periphery\/contracts"
truffle compile


# copy uniswap artifacts
# cp ./node_modules/@uniswap/v2-core/build/UniswapV2Pair.json ./build/contracts
# cp ./node_modules/@uniswap/v2-core/build/UniswapV2Factory.json ./build/contracts
# cp ./node_modules/@uniswap/v2-periphery/build/WETH9.json ./build/contracts
# cp ./node_modules/@uniswap/v2-periphery/build/TransferHelper.json ./build/contracts
# cp ./node_modules/@uniswap/v2-periphery/build/UniswapV2Router02.json ./build/contracts
