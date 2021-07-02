#!/bin/bash
if [ ! -f .env ]
then
  export $(cat .env | xargs)
fi
ganache-cli --port 8545 --gasLimit 100000000 --accounts 10 --hardfork istanbul --mnemonic "pattern lumber mystery retreat answer wheel seminar adult practice air bring essence" --fork https://rinkeby.infura.io/v3/$INFURA_ID --unlock 0xf0774219823852e445fb592f15d13a336315a0f8 --chainId 1