#!/bin/bash
export CONFIG_NAME="./truffle-config.js"
source ./scripts/utils/generate_truffle_config.sh


function verifyAll {

  generate_truffle_config "0.4.24" ".\/contracts\/governance"
  truffle run verify Voting@0x4AE71D6fEE2fCf95aD3D9CA68823e737E23cA5Be --network $1
  truffle run verify VotingStakingRewards@0x86fD94250f15DE849Ae71849201Ba6fFa1cB292e --network $1

  generate_truffle_config "0.6.6" ".\/contracts\/main"
  truffle run verify BonusCampaign@0x073C6972D70DfA72C2637bBe38916d46C015b34F --network $1
  truffle run verify VeXBE@0x26d26e720f7E592b4d8Af1B7217543938ba2A2A6 --network $1
  # truffle run verify XBEInflation --network $1
  # truffle run verify MockToken@0xf154BFcA3130c9bf697a625B7Fa5FC9ABcEb55eb --network $1

  # truffle run verify HiveStrategy --network $1
  # truffle run verify HiveVault --network $1
  # truffle run verify ReferralProgram --network $1
  # truffle run verify Registry --network $1
  # truffle run verify Treasury --network $1
  # truffle run verify Controller --network $1
  #
  # truffle run verify SushiStrategy --network $1
  # truffle run verify SushiVault --network $1
  # truffle run verify CVXStrategy --network $1
  # truffle run verify CVXVault --network $1
  # truffle run verify CvxCrvStrategy --network $1
  # truffle run verify CvxCrvVault --network $1

  # truffle run verify ReferralProgram@0xB73d03Baa6796Abbc51C8A588c4C38231cE0b104 --network $1
  # truffle run verify BonusCampaign@0xbce5A336944fa3c270A31bB7D148CbbF01E2C1bc --network $1
  # truffle run verify VeXBE@0x68948cDbbA994F448667ddEfF2983Ee36ae1868C --network $1
  # truffle run verify XBEInflation@0x1b17270E564B095504b80AD3b63de48A2172D886 --network $1
  # truffle run verify MockToken@0xb56e26f48c380C7beEAC75832011D1A5Ee33428B --network $1

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
