#!/bin/bash
export CONFIG_NAME="./truffle-config.js"
source ./scripts/utils/generate_truffle_config.sh


function verifyAll {

  generate_truffle_config "0.4.24" ".\/contracts\/governance"
  truffle run verify Voting@0xA945174151b8C821aFa6023dF6B5aA26ff3FdD0F --network $1
  truffle run verify VotingStakingRewards@0xe5B381FFd4Ba3e9cC680d2732eAD52B74dB47A02 --network $1

  generate_truffle_config "0.6.6" ".\/contracts\/main"
  # truffle run verify ReferralProgram@0xB73d03Baa6796Abbc51C8A588c4C38231cE0b104 --network $1
  # truffle run verify BonusCampaign@0xbce5A336944fa3c270A31bB7D148CbbF01E2C1bc --network $1
  truffle run verify VeXBE@0x7D386e7306E36656e50Bb12Fd4ADfAdcf002ECb2 --network $1
  # truffle run verify XBEInflation@0x1b17270E564B095504b80AD3b63de48A2172D886 --network $1
  truffle run verify MockToken@0x6e1C2411Fd4388D6fB6aD1Ad105B6F5021F47815 --network $1

  # truffle run verify HiveStrategy@0x26eF5fE8952bAF5fA2d1CF8FF12A7D04C500a4BC --network $1
  # truffle run verify HiveVault@0xde3a52695a7149073208b7a862352734f48537Bc --network $1
  # truffle run verify ReferralProgram@0xeCD8B38893dD51aEc09a742a8323c1736c5f03C3 --network $1
  # truffle run verify Registry@0xe02268B6C8e1AC10Bcf5a038fe6966333b1C6b84 --network $1
  # truffle run verify Treasury@0xB138642D1D955265F7191A24094CA0582A390414 --network $1
  # truffle run verify Controller@0x83793D8C147b23579F07CaB59d03aB88874B85A1 --network $1

}

if [ -z $1 ]; then
  verifyAll rinkeby
else
  if [ -z $2 ]; then
    truffle run verify $1 --network rinkeby
  else
    if [[ $1 = "all" ]]; then
      verifyAll $2
    else
      truffle run verify $1 --network $2
    fi
  fi
fi

# remove config file
rm -f $CONFIG_NAME
