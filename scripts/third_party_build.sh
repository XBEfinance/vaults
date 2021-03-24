#!/bin/bash

# copy uniswap artifacts
cp ./node_modules/@uniswap/v2-core/build/UniswapV2Pair.json ./build/contracts
cp ./node_modules/@uniswap/v2-core/build/UniswapV2Factory.json ./build/contracts
cp ./node_modules/@uniswap/v2-periphery/build/WETH9.json ./build/contracts
cp ./node_modules/@uniswap/v2-periphery/build/TransferHelper.json ./build/contracts
cp ./node_modules/@uniswap/v2-periphery/build/UniswapV2Router02.json ./build/contracts
