#!/bin/bash

set -a # automatically export all variables
source .env
set +a

ganache-cli --accounts 100 -e 1000 --fork $ALCHEMY_URL --mnemonic "enforce creek agree hood iron excuse pride movie fluid water oven shield"
