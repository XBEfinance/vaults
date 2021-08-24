/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  // constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
// const { contract } = require('@openzeppelin/test-environment');
const { people, setPeople } = require('./utils/accounts');
const common = require('./utils/common');
const constants = require('./utils/constants');
const environment = require('./utils/environment');
var Eth = require('web3-eth');



const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
  processAllEvents,
} = require('./utils/old/common');

const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
  beforeEachWithSpecificDeploymentParams,
} = require('./utils/old/deploy_strategy_infrastructure.js');
// const { contract } = require('@openzeppelin/test-environment');
var eth = new Eth(Eth.givenProvider || 'ws://127.0.0.1:8545');

let mockXBE;
  let mockCX;
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let vaultWithXBExCXStrategy;

  let deployment;

contract('XBEInflation', (accounts) => {
  setPeople(accounts);

  beforeEach(async () => {
    // constants.localParams.bonusCampaign.startMintTime = await time.latest();
    [
        mockXBE,
        xbeInflation
    ] = await environment.getGroup(
        environment.defaultGroup,
        (key) => {
            return [
                "MockXBE",
                "XBEInflation"
            ].includes(key);
        },
        true
    );
  });


  describe('with default params of deployment', () => {

    // beforeEach(async () => {
    //   [
    //     vaultWithXBExCXStrategy,
    //     mockXBE,
    //     mockCX,
    //     xbeInflation,
    //     bonusCampaign,
    //     veXBE,
    //     voting,
    //   ] = await beforeEachWithSpecificDeploymentParams(people.owner, people.alice, people.bob);
    // });

    xit('should configure XBEInflation properly', async () => {

      expect(await xbeInflation.admin()).to.be.equal(people.owner);
      expect(await xbeInflation.token()).to.be.equal(mockXBE.address);

      expect((await xbeInflation.initialRate()).toString()).to.be.equal(
        defaultParams.xbeinflation.initialRate.toString(),
      );
      expect((await xbeInflation.rateReductionTime()).toString()).to.be.equal(
        defaultParams.xbeinflation.rateReductionTime.toString(),
      );
      expect((await xbeInflation.rateDenominator()).toString()).to.be.equal(
        defaultParams.xbeinflation.rateDenominator.toString(),
      );
      expect((await xbeInflation.rateReductionCoefficient()).toString()).to.be.equal(
        defaultParams.xbeinflation.rateReductionCoefficient.toString(),
      );
      // expect(
      //   (
      //     (await xbeInflation.startEpochTime()).sub(
      //       (await time.latest())
      //         .add(defaultParams.xbeinflation.inflationDelay)
      //        .sub(defaultParams.xbeinflation.rateReductionTime),
      //     )
      //   ).toString(),
      // ).to.be.most(constants.utils.ONE.toString());
      expect( (await xbeInflation.miningEpoch()).toString() ).to.be.equal(
        new BN('-1').toString(),
      );
      expect( (await xbeInflation.rate()).toString() ).to.be.equal(constants.utils.ZERO.toString());

      const supplyInWei = defaultParams.xbeinflation.initialSupply.mul(
        new BN('10').pow(await mockXBE.decimals()),
      );
      expect( (await xbeInflation.totalMinted()).toString() ).to.be.equal(supplyInWei.toString());
      expect( (await xbeInflation.startEpochSupply()).toString() ).to.be.equal(
        supplyInWei.toString(),
      );
    });

    xit('should update minting parameters', async () => {
      console.log('should update minting parameters0');

      await expectRevert(xbeInflation.updateMiningParameters(), 'tooSoon');
      console.log('should update minting parameters1');
      await time.increase(
        (await xbeInflation.rateReductionTime()).add(constants.time.days('1')),
      );
      console.log('should update minting parameters2');

      let expectedStartEpochSupply = await xbeInflation.startEpochSupply();
      let expectedRate = await xbeInflation.initialRate();
      let result = await xbeInflation.updateMiningParameters();
      let blockTimestamp = new BN(
        (await eth.getBlock(result.receipt.blockNumber)).timestamp.toString(),
      );

      processEventArgs(result, 'UpdateMiningParameters', (args) => {
        expect(args.time.toString()).to.be.equal(blockTimestamp.toString());
        expect(args.rate.toString()).to.be.equal(expectedRate.toString());
        expect(args.supply.toString()).to.be.equal(expectedStartEpochSupply.toString());
      });

      await time.increase(
        await xbeInflation.rateReductionTime(),
      );

      const oldRate = await xbeInflation.rate();
      const rateReductionTime = await xbeInflation.rateReductionTime();

      expectedStartEpochSupply = expectedStartEpochSupply.add(
        oldRate.mul(rateReductionTime),
      );

      expectedRate = oldRate
        .mul(await xbeInflation.rateDenominator())
        .div(await xbeInflation.rateReductionCoefficient());

      result = await xbeInflation.updateMiningParameters();

      blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString(),
      );

      processEventArgs(result, 'UpdateMiningParameters', (args) => {
        expect(args.time.toString()).to.be.equal(blockTimestamp.toString());
        expect(args.rate.toString()).to.be.equal(expectedRate.toString());
        expect(args.supply.toString()).to.be.equal(expectedStartEpochSupply.toString());
      });
    });


    xit('should set admin role', async () => {
      await expectRevert(
        xbeInflation.setAdmin(ZERO_ADDRESS, { from: people.alice }),
        '!admin',
      );
      const result = await xbeInflation.setAdmin(people.alice);
      expect(await xbeInflation.admin()).to.be.equal(people.alice);
      processEventArgs(result, 'SetAdmin', (args) => {
        expect(args.admin).to.be.equal(people.alice);
      });
    });

    xit('should get current available supply', async () => {
      expect((await xbeInflation.availableSupply()).toString() ).to.be.equal(
        (await xbeInflation.startEpochSupply()).add(
          (await time.latest())
            .sub(await xbeInflation.startEpochTime())
            .mul(await xbeInflation.rate()),
        ).toString(),
      );
    });

    xit('should get timestamp of the current mining epoch start while simultaneously updating minting parameters', async () => {
      let result = await xbeInflation.startEpochTimeWrite();
      await expectEvent.notEmitted(result, 'UpdateMiningParameters');

      await time.increase(
        (await xbeInflation.startEpochTime()).add(
          await xbeInflation.rateReductionTime(),
        ),
      );

      result = await xbeInflation.startEpochTimeWrite();

      const startEpochTime = await xbeInflation.startEpochTime();

      const expectedStartEpochSupply = await xbeInflation.startEpochSupply();
      const expectedRate = await xbeInflation.initialRate();
      const blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString(),
      );

      processEventArgs(result, 'UpdateMiningParameters', (args) => {
        expect(args.time.toString()).to.be.equal(blockTimestamp.toString());
        expect(args.rate.toString()).to.be.equal(expectedRate.toString());
        expect(args.supply.toString()).to.be.equal(expectedStartEpochSupply.toString());
      });

      processEventArgs(result, 'CalculatedEpochTimeWritten', (args) => {
        expect(args.epochTime.toString()).to.be.equal(startEpochTime.toString());
      });
    });

    it('should get timestamp of the next mining epoch start while simultaneously updating mining parameters', async () => {
      const startEpochTime = (await xbeInflation.startEpochTime())
        .add(await xbeInflation.rateReductionTime());

      let result = await xbeInflation.futureEpochTimeWrite();
      await expectEvent.notEmitted(result, 'UpdateMiningParameters');
      let blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString(),
      );
      console.log("ts1 = ", blockTimestamp.toString());

      await time.increase(
        (await xbeInflation.startEpochTime()).add(
          await xbeInflation.rateReductionTime(),
        ),
      );

      console.log("time increase on: ",
        (await xbeInflation.startEpochTime()).add(
        await xbeInflation.rateReductionTime(),
      ).toString())
      console.log("startEpochTime = ", (await xbeInflation.startEpochTime()).toString() );
      console.log("rateReductionTime = ", (await xbeInflation.rateReductionTime()).toString() );

      result = await xbeInflation.futureEpochTimeWrite();

      // console.log("result = ", result);


      const expectedStartEpochSupply = await xbeInflation.startEpochSupply();
      const expectedRate = await xbeInflation.initialRate();
      blockTimestamp = new BN(
        (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp.toString(),
      );
      console.log("ts2 = ", blockTimestamp.toString());

      processEventArgs(result, 'UpdateMiningParameters', (args) => {
        expect(args.time.toString()).to.be.equal(blockTimestamp.toString());
        expect(args.rate.toString()).to.be.equal(expectedRate.toString());
        expect(args.supply.toString()).to.be.equal(expectedStartEpochSupply.toString());
      });

      processEventArgs(result, 'CalculatedEpochTimeWritten', (args) => {
        expect(args.epochTime.toString()).to.be.equal(startEpochTime.toString());
      });
    });
  });

  describe('with specific deployment params', () => {

    xit('should reject getting amount of how much can be minted during the interval if requires are failed', async () => {
      await expectRevert(
        xbeInflation.mintableInTimeframe(constants.utils.ONE, constants.utils.ZERO),
        'startGtEnd',
      );

      await time.increaseTo(
        (await xbeInflation.startEpochTime()).add(
          await xbeInflation.rateReductionTime(),
        ),
      );

      await xbeInflation.updateMiningParameters();

      const timeEnd = (await xbeInflation.startEpochTime()).add(
        await xbeInflation.rateReductionTime(),
      );

      await expectRevert(
        xbeInflation.mintableInTimeframe(constants.utils.ZERO, timeEnd),
        'currentRateGtInitialRate',
      );

      const now = await time.latest();

      await expectRevert(
        xbeInflation.mintableInTimeframe(
          now,
          now.add(days('365').div(new BN('2'))),
        ),
        'tooFarInFuture',
      );
    });

    xit('should get amount of how much can be minted during the interval', async () => {
      const now = await time.latest();
      const mintableAmount = await xbeInflation.mintableInTimeframe(
        now,
        now.add(days('2')),
      );
      console.log(mintableAmount.toString());
    });

    // it('should mint', async () => {
    //   await expectRevert(xbeInflation.mint(ZERO_ADDRESS, constants.utils.ZERO), '!zeroAddress');
    //   await expectRevert(xbeInflation.mint(people.alice, constants.utils.ZERO, { from: people.alice }), '!minter');

    //   const lpToDeposit = ether('2');

    //   await vaultWithXBExCXStrategy.approve(
    //     liquidityGaugeReward.address,
    //     lpToDeposit,
    //     { from: people.alice },
    //   );
    //   await liquidityGaugeReward.methods['deposit(uint256)'](lpToDeposit, {
    //     from: people.alice,
    //   });

    //   await time.increase(days('20'));

    //   const oldBalance = await mockXBE.balanceOf(people.alice);

    //   const result = await minter.mint(liquidityGaugeReward.address, {
    //     from: people.alice,
    //   });
    //   const newBalance = await mockXBE.balanceOf(people.alice);

    //   processEventArgs(result, 'Minted', (args) => {
    //     expect(args.recipient).to.be.equal(people.alice);
    //     expect(args.gauge).to.be.equal(liquidityGaugeReward.address);
    //     expect(args.minted).to.be.bignumber.equal(newBalance.sub(oldBalance));
    //   });
    // });
  });
});
