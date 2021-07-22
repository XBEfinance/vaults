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
  truffle run verify Voting@0x9D21852E4156e77E07515E2cF7306b8428f46369 --network $1
  truffle run verify VotingStakingRewards@0xbAbaDE460fe12774F6b1610dab3084DF1A3B9951 --network $1

  generate_truffle_config "0.6.6" ".\/contracts\/main"
  truffle run verify BonusCampaign@0x5B7A9fA591b20134bcd85317E76521Ea58C726Fe --network $1
  truffle run verify VeXBE@0x40788336d3a13A49b77a096eb1f708818398B9c2 --network $1
  truffle run verify XBEInflation@0x4308a1fFb0F809080C2Df30C98c44fD08360D946 --network $1
  truffle run verify MockToken@0x159c0dd760709Fb0af0e0A8c56A3bA5c59e09A2F --network $1

  truffle run verify HiveStrategy@0x635BC7B8b6E17114fd13C029e743BC8Bda606f50 --network $1
  truffle run verify HiveVault@0x76d4f06695575e1933031bfda68c4bb17971fc51 --network $1
  truffle run verify ReferralProgram@0x7BA85c8cB9110b82B142ea03F6d5587A42C95CE8 --network $1
  truffle run verify Registry@0xc6Bf1D35aDE57697CeA9AC263B63581996eA4DC4 --network $1
  truffle run verify Treasury@0xff004bEe18B6FE6F90950cd2B32fb2285e42992C --network $1
  truffle run verify Controller@0x2499e5169DC682DCB3C3E667230e3190e0F2e12A --network $1
  #
  # truffle run verify SushiStrategy@0x8021486f59D089D630161C365084e28cEFdf320B --network $1
  # truffle run verify SushiVault@0x1680E036A779d0bc40E9b44373C529fb37Dd3c69 --network $1
  # truffle run verify CVXStrategy@0xd20FEB7a02880a07B60c976d359056e437863eBD --network $1
  # truffle run verify CVXVault@0x6DF7Fc93321056c8fCB3143F1A3783bB8fDb22b1 --network $1
  # truffle run verify CvxCrvStrategy@0x69fc46d61843ecAfeF221D07A7Fb4FF46942281c --network $1
  # truffle run verify CvxCrvVault@0x96867a241eC4a95551cf3E303e1f1FA89A0091aa --network $1

  # truffle run verify ReferralProgram --network $1
  # truffle run verify BonusCampaign --network $1
  # truffle run verify VeXBE --network $1
  # truffle run verify XBEInflation --network $1
  # truffle run verify MockToken --network $1

  # truffle run verify HiveStrategy@0x26eF5fE8952bAF5fA2d1CF8FF12A7D04C500a4BC --network $1
  # truffle run verify HiveVault@0xde3a52695a7149073208b7a862352734f48537Bc --network $1
  # truffle run verify ReferralProgram@0xeCD8B38893dD51aEc09a742a8323c1736c5f03C3 --network $1
  # truffle run verify Registry@0xe02268B6C8e1AC10Bcf5a038fe6966333b1C6b84 --network $1
  # truffle run verify Treasury@0xB138642D1D955265F7191A24094CA0582A390414 --network $1
  # truffle run verify Controller@0x83793D8C147b23579F07CaB59d03aB88874B85A1 --network $1

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
