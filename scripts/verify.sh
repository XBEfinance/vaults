#!/bin/bash
export CONFIG_NAME="./truffle-config.js"
source ./scripts/utils/generate_truffle_config.sh


function verifyAll {

  generate_truffle_config "0.4.24" ".\/contracts\/governance"
  # truffle run verify Voting@0xd663bcC07FD2C42Ce13c322dA1Eb13F080DDA38B --network $1
  truffle run verify VotingStakingRewards@0x2987E4658662389758B8c3c915Ef8003feBCFe65 --network $1

  generate_truffle_config "0.6.6" ".\/contracts\/main"
  # truffle run verify BonusCampaign@0x02A34637E7673D954A83C7f87E3c51875EE5CF3f --network $1
  # truffle run verify VeXBE@0xE3cfe95F6D3Fb498FE815255918238c12b15f891 --network $1
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

function verifyAll_1 {
  generate_truffle_config "0.4.24" ".\/contracts\/governance"
#  truffle run verify Voting --network $1
  truffle run verify VotingStakingRewards --network $1

  generate_truffle_config "0.6.6" ".\/contracts\/main"
  truffle run verify BonusCampaign --network $1
  truffle run verify VeXBE --network $1
  truffle run verify SimpleXBEInflation --network $1
#  truffle run verify MockToken --network $1

  truffle run verify HiveStrategy --network $1
  truffle run verify HiveVault --network $1
  truffle run verify SushiStrategy --network $1
  truffle run verify SushiVault --network $1
  truffle run verify CVXStrategy --network $1
  truffle run verify CVXVault --network $1
  truffle run verify CvxCrvStrategy --network $1
  truffle run verify CvxCrvVault --network $1
  truffle run verify ReferralProgram --network $1
  truffle run verify Registry --network $1
  truffle run verify Treasury --network $1
  truffle run verify Controller --network $1
  truffle run verify LockSubscription --network $1

#  generate_truffle_config "0.4.24" ".\/contracts\/governance"
##  truffle run verify Voting --network $1
#  truffle run verify VotingStakingRewards@0x0c0636ff0Cf8Cc75f2920681c83C883c8379Ac07 --network $1
#
#  generate_truffle_config "0.6.6" ".\/contracts\/main"
#  truffle run verify BonusCampaign@0xB0788d3c7E44A9b406aCAa5C6e4a926F91981B20 --network $1
#  truffle run verify VeXBE@0x9d8a892d57840c4A7bc799AE5875b12De78Fb22E --network $1
#  truffle run verify SimpleXBEInflation@0x7533bE6EcCa6CE432b2c15576CA5c52777004d09 --network $1
##  truffle run verify MockToken --network $1
#
#  truffle run verify HiveStrategy@0xc74c79D43105e7590DEDc46AD3cB498246Aa827e --network $1
#  truffle run verify Vault@0xbBF4B2CB7Fc867f39f0919dcb32b6064Db5aD5C4 --network $1
#  truffle run verify SushiStrategy@0x64165509011e3AE15c2e7c15C53cCbAb88C43F08 --network $1
#  truffle run verify SushiVault@0x6648eb74a8C69aC9C1B0ECcB9481f3b39909B009 --network $1
#  truffle run verify CVXStrategy@0x987A84B23c8e53B3Bcf68818cf6d9c5c54549949 --network $1
#  truffle run verify Vault@0xAbE4aC62Db1c944e83bEA503b9247E25952c46a5 --network $1
#  truffle run verify CvxCrvStrategy@0x418B99d8358ffCce8e723359FDc5835B93588101 --network $1
#  truffle run verify Vault@0xdBe60E5f0A374aa83b0AFEa8Ec05Cf28eF2ED123 --network $1
#  truffle run verify ReferralProgram@0x031781238C61e4F0f75bD0C60AC6BBC0Ca436cae --network $1
#  truffle run verify Registry@0x29f2c35809664144c3Ab86088b7C86C22d3B2EeA --network $1
#  truffle run verify Treasury@0x1D235Ac7C038F2c29FA97D1bc2ea4a1660cba1A8 --network $1
#  truffle run verify Controller@0x7Fe30F1E809ED5E3633fAb7Dd3EEd89109571A6c --network $1
#  truffle run verify LockSubscription@0x7A24c21Fc045b3c86CE138D8AF315f18A50C78E1 --network $1
}

if [ -z $1 ]; then
  verifyAll_1 rinkeby
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
