#!/bin/bash

set -a # automatically export all variables
source .env
set +a

ganache-cli --port 8545 --gasLimit 100000000 --accounts 100 -e 1000 --mnemonic ${MNEMONIC} --fork https://rinkeby.infura.io/v3/$INFURA_ID --unlock 0xf0774219823852e445fb592f15d13a336315a0f8 --chainId 1
