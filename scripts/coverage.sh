#!/bin/bash

export CONFIG_NAME="./truffle-config.js"

if [[ $1 = "+fast" ]]; then
  echo "Run coverage without build!"
  SKIP_REBUILD=true
  shift
else
  # remove previous build
  rm -rf ./build

  mkdir -p build/contracts/

  ./scripts/main_parts_build.sh
fi

source ./scripts/utils/generate_truffle_config.sh
generate_truffle_config "0.6.3" ".\/contracts\/main" "false"

source ./scripts/utils/generate_truffle_config.sh
generate_truffle_config "0.6.3" ".\/contracts\/main" "false"

function specify_coverage {
  if [[ $1 = "file" ]]; then
    node --max-old-space-size=4096 ./node_modules/.bin/truffle run coverage --file $2 --network $3
  elif [[ -z "$1" ]]; then
    node --max-old-space-size=4096 ./node_modules/.bin/truffle run coverage
  else
    node --max-old-space-size=4096 ./node_modules/.bin/truffle run coverage --network $1
  fi
}

#run coverage
if [[ $1 = "file" ]]; then
  echo "File pattern specified, proceeding..."
  specify_coverage "file" $2 $3
elif [[ -z "$1" ]]; then
  specify_coverage
else
  echo "Total coverage requested..."
  specify_coverage $1
fi

if [[ $SKIP_REBUILD != true ]]; then
  # remove build
  rm -rf ./build
fi
  # remove config file
  rm -f $CONFIG_NAME
