/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */
const { fromAscii, asciiToHex, keccak256 } = require("web3-utils");
const { expect, assert } = require("chai");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time,
} = require("@openzeppelin/test-helpers");

const Voting = artifacts.require("Voting");
const EVMScriptExecutorMock = artifacts.require("EVMScriptExecutorMock");

const { newApp, newDao, ANY_ADDRESS, APP_ID } = require("./utils/dao.js");

const { ZERO_ADDRESS } = constants;
const {
  ZERO,
  ONE,
  getMockTokenPrepared,
  processEventArgs,
} = require("./utils/common.js");
const {
  deployInfrastructure,
  YEAR,
  MULTIPLIER,
  days,
  defaultParams,
} = require("./utils/deploy_infrastructure.js");

contract("Voting", ([owner, alice, bob, tod]) => {
  let mockXBE;
  let mockCRV;
  let xbeInflation;
  let bonusCampaign;
  let veXBE;
  let voting;
  let stakingRewards;
  let vaultWithXBExCRVStrategy;
  let executorMock;
  let votingApp;
  let abi;
  const votesRole = keccak256("CREATE_VOTES_ROLE");
  const supportRole = keccak256("MODIFY_SUPPORT_ROLE");
  const quorumRole = keccak256("MODIFY_QUORUM_ROLE");
  const scriptForTests = "0x0000000200";

  let deployment;
  async function configuration() {
    deployment = deployInfrastructure(owner, alice, bob, defaultParams);
    [
      mockXBE,
      mockCRV,
      xbeInflation,
      bonusCampaign,
      veXBE,
      voting,
      stakingRewards
    ] = await deployment.proceed();
  }

  async function setOpenPermission(
    rightHolder,
    acl,
    appAddress,
    role,
    rootAddress
  ) {
    await acl.createPermission(
      rightHolder, // entity (who?) - The entity or address that will have the permission.
      appAddress, // app (where?) - The app that holds the role involved in this permission.
      role, // role (what?) - The particular role that the entity is being assigned to in this permission.
      rootAddress, // manager - Can grant/revoke further permissions for this role.
      { from: rootAddress }
    );
  }

  async function initializeDaoAndVotingWithRole(
    role,
    votingSupport = defaultParams.voting.supportRequiredPct,
    votingMinAccept = defaultParams.voting.minAcceptQuorumPct,
    votingTime = defaultParams.voting.voteTime
  ) {
    await configuration();
    const { dao, acl, EVMScriptRegistry } = await newDao(owner);
    const proxyAddress = await newApp(dao, voting.address, owner);
    votingApp = await Voting.at(proxyAddress);
    votingApp.initialize(
      veXBE.address,
      votingSupport,
      votingMinAccept,
      votingTime
    );
    executorMock = await EVMScriptExecutorMock.new();
    const scriptRegistry = await EVMScriptRegistry.at(
      await votingApp.getEVMScriptRegistry()
    );
    const REGISTRY_ADD_EXECUTOR_ROLE = await scriptRegistry.REGISTRY_ADD_EXECUTOR_ROLE();
    // setting permission to address
    await setOpenPermission(alice, acl, votingApp.address, role, owner);
    await setOpenPermission(
      alice,
      acl,
      votingApp.address,
      REGISTRY_ADD_EXECUTOR_ROLE,
      owner
    );
    await acl.createPermission(
      alice,
      scriptRegistry.address,
      REGISTRY_ADD_EXECUTOR_ROLE,
      alice,
      { from: owner }
    );
    abi = await mockXBE.contract.methods["mintSender(uint256)"](
      "100000"
    ).encodeABI();
    await scriptRegistry.addScriptExecutor(executorMock.address, {
      from: alice,
    });
  }

  describe("Initialization Voting", () => {
    beforeEach(async () => {
      await configuration()
    });
    it("initialization: expect revert", async () => {
      expectRevert(
        voting.initialize(
          veXBE.address,
          new BN("10").pow(new BN("19")),
          new BN("3000"),
          new BN("1000000")
        ),
        "VOTING_INIT_SUPPORT_TOO_BIG"
      );
    });
    it("initialization: expect revert", async () => {
      expectRevert(
        voting.initialize(
          veXBE.address,
          new BN("10").pow(new BN("16")),
          new BN("10").pow(new BN("18")),
          new BN("1000000")
        ),
        "VOTING_INIT_PCTS"
      );
    });
    it("initialization: expect revert", async () => {
      await voting.initialize(
        veXBE.address,
        new BN("10").pow(new BN("17")),
        new BN("10").pow(new BN("16")),
        new BN("1000000")
      );
      expectRevert(
        voting.initialize(
          veXBE.address,
          new BN("10").pow(new BN("17")),
          new BN("10").pow(new BN("16")),
          new BN("1000000")
        ),
        "alreadyInitialized"
      );
    });
    it("initialization: expect successful", async () => {
      await voting.initialize(
        veXBE.address,
        new BN("10000"),
        new BN("1000"),
        new BN("1000000")
      );
      expect(await voting.token.call()).to.be.equal(veXBE.address);
      expect(await voting.supportRequiredPct.call()).to.be.bignumber.equal(
        new BN("10000")
      );
      expect(await voting.minAcceptQuorumPct.call()).to.be.bignumber.equal(
        new BN("1000")
      );
      expect(await voting.voteTime.call()).to.be.bignumber.equal(
        new BN("1000000")
      );
    });
  });
  describe("Get state", () => {
    beforeEach(async () => {
      await initializeDaoAndVotingWithRole(votesRole);
      await veXBE.configure(
        mockXBE.address,
        "Voting Escrowed XBE",
        "veXBE",
        "0.0.1"
      );
    });
    it("Get constants", async () => {
      const votes = await votingApp.CREATE_VOTES_ROLE.call();
      const support = await voting.MODIFY_SUPPORT_ROLE.call();
      const quorum = await voting.MODIFY_QUORUM_ROLE.call();
      expect(votes).to.be.equal(votesRole);
      expect(support).to.be.equal(supportRole);
      expect(quorum).to.be.equal(quorumRole);
    });
    it("isForwarder", async () => {
      const isForwarder = await votingApp.isForwarder.call();
      expect(isForwarder).to.be.equal(true);
    });
  });
  describe("Change supportRequiredPct", () => {
    beforeEach(async () => {
      await initializeDaoAndVotingWithRole(supportRole);
    });
    it("change supportRequiredPct: expect revert", async () => {
      expectRevert(
        votingApp.changeSupportRequiredPct(new BN("50000"), { from: bob }),
        "APP_AUTH_FAILED"
      );
    });
    it("change supportRequiredPct: expect revert", async () => {
      expectRevert(
        votingApp.changeSupportRequiredPct(new BN("2000"), { from: alice }),
        "VOTING_CHANGE_SUPPORT_PCTS"
      );
    });
    it("change supportRequiredPct: expect revert", async () => {
      expectRevert(
        votingApp.changeSupportRequiredPct(new BN("10").pow(new BN("19")), {
          from: alice,
        }),
        "VOTING_CHANGE_SUPP_TOO_BIG"
      );
    });
    it("change supportRequiredPct: successful", async () => {
      const { logs } = await votingApp.changeSupportRequiredPct(
        new BN("50000"),
        { from: alice }
      );
      const newValue = await votingApp.supportRequiredPct.call();
      expectEvent.inLogs(logs, "ChangeSupportRequired", {
        supportRequiredPct: newValue,
      });
      expect(newValue).to.be.bignumber.equal(new BN("50000"));
    });
  });
  describe("Change MinAcceptQuorumPct", () => {
    beforeEach(async () => {
      await initializeDaoAndVotingWithRole(quorumRole);
    });
    it("change MinAcceptQuorumPct: expect revert", async () => {
      expectRevert(
        votingApp.changeMinAcceptQuorumPct(new BN("1000"), { from: bob }),
        "APP_AUTH_FAILED"
      );
    });
    it("change MinAcceptQuorumPct: expect revert", async () => {
      expectRevert(
        votingApp.changeMinAcceptQuorumPct(new BN("100000"), { from: alice }),
        "VOTING_CHANGE_QUORUM_PCTS"
      );
    });
    it("change MinAcceptQuorumPct: successful", async () => {
      const { logs } = await votingApp.changeMinAcceptQuorumPct(
        new BN("1000"),
        { from: alice }
      );
      const newValue = await votingApp.minAcceptQuorumPct.call();
      expectEvent.inLogs(logs, "ChangeMinQuorum", {
        minAcceptQuorumPct: newValue,
      });
      expect(newValue).to.be.bignumber.equal(new BN("1000"));
    });
  });
  describe("Create vote", () => {
    beforeEach(async () => {
      await initializeDaoAndVotingWithRole(votesRole);
      await veXBE.configure(
        mockXBE.address,
        "Voting Escrowed XBE",
        "veXBE",
        "0.0.1"
      );
      const timeLast = await time.latest();
      await mockXBE.mint(alice, ether("10000"), { from: alice });
      await mockXBE.approve(veXBE.address, ether("10000"), { from: alice });

      await mockXBE.mint(bob, ether("10000"), { from: bob });
      await mockXBE.approve(veXBE.address, ether("10000"), { from: bob });
      await time.increase(
        Math.floor(timeLast.toNumber() / time.duration.weeks(1) + 1) *
          time.duration.weeks(1) -
          timeLast.toNumber()
      );
      await time.advanceBlock();

      await time.increase(time.duration.hours(1));
    });
    it("newVote: expect revert", async () => {
      expectRevert(
        votingApp.methods["newVote(bytes,string)"]("0x", "string", {
          from: bob,
        }),
        "APP_AUTH_FAILED"
      );
    });
    it("newVote: expect revert", async () => {
      expectRevert(
        votingApp.methods["newVote(bytes,string)"]("0x", "string", {
          from: alice,
        }),
        "VOTING_NO_VOTING_POWER"
      );
    });
    it("newVote: create successful", async () => {
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: alice }
      );
      const block = await time.latestBlock();
      const timeStump = await time.latest();
      const { logs } = await votingApp.methods[
        "newVote(bytes,string,bool,bool)"
      ](scriptForTests, "string", false, false, { from: alice });
      const {
        open,
        executed,
        startDate,
        snapshotBlock,
        supportRequired,
        minAcceptQuorum,
        yea,
        nay,
        script,
      } = await votingApp.getVote.call("0");
      const votesLength = await votingApp.votesLength.call();
      expectEvent.inLogs(logs, "StartVote", {
        voteId: "0",
        creator: alice,
        metadata: "string",
      });

      expect(votesLength).to.be.bignumber.equal(new BN("1"));
      expect(open).to.be.equal(true);
      expect(executed).to.be.equal(false);
      expect(startDate).to.be.bignumber.closeTo(timeStump, "10");
      expect(snapshotBlock).to.be.bignumber.equal(block);
      expect(supportRequired).to.be.bignumber.equal(
        defaultParams.voting.supportRequiredPct
      );
      expect(minAcceptQuorum).to.be.bignumber.equal(
        defaultParams.voting.minAcceptQuorumPct
      );
      expect(script).to.equal(scriptForTests);
      // expect(yea).to.be.bignumber.equal(aliceBalance);
      expect(nay).to.be.bignumber.equal(new BN("0"));
    });
    it("newVote: create successful via another func", async () => {
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: alice }
      );
      const block = await time.latestBlock();
      const timeStump = await time.latest();
      const { logs } = await votingApp.methods[
        "newVote(bytes,string,bool,bool)"
      ](scriptForTests, "string", false, false, { from: alice });
      const {
        open,
        executed,
        startDate,
        snapshotBlock,
        supportRequired,
        minAcceptQuorum,
        yea,
        nay,
        script,
      } = await votingApp.getVote.call("0");
      expectEvent.inLogs(logs, "StartVote", {
        voteId: "0",
        creator: alice,
        metadata: "string",
      });
      const votesLength = await votingApp.votesLength.call();

      expect(votesLength).to.be.bignumber.equal(new BN("1"));
      expect(open).to.be.equal(true);
      expect(executed).to.be.equal(false);
      expect(startDate).to.be.bignumber.closeTo(timeStump, "10");
      expect(snapshotBlock).to.be.bignumber.equal(block);
      expect(supportRequired).to.be.bignumber.equal(
        defaultParams.voting.supportRequiredPct
      );
      expect(minAcceptQuorum).to.be.bignumber.equal(
        defaultParams.voting.minAcceptQuorumPct
      );
      expect(script).to.equal(scriptForTests);
      expect(yea).to.be.bignumber.equal(new BN("0"));
      expect(nay).to.be.bignumber.equal(new BN("0"));
    });
    it("newVote: expect revert via forward", async () => {
      expectRevert(
        votingApp.forward(scriptForTests, { from: bob }),
        "VOTING_CAN_NOT_FORWARD"
      );
    });
    it("newVote with _castVote: expect success", async () => {
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: alice }
      );
      const { logs } = await votingApp.methods["newVote(bytes,string,bool,bool)"](
        scriptForTests,
        "string",
        true,
        true,
        { from: alice }
      );
      expectEvent.inLogs(logs, "StartVote", {
        voteId: "0",
        creator: alice,
        metadata: "string",
      });

    });
    it("newVote: create successful via forward", async () => {
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: bob }
      );
      const { logs } = await votingApp.methods["forward(bytes)"](
        fromAscii("mocha"),
        { from: alice }
      );
      expectEvent.inLogs(logs, "StartVote", {
        voteId: "0",
        creator: alice,
      });
    });
  });
  describe("Vote", () => {
    let aliceStake;
    let bobStake;
    beforeEach(async () => {
      await initializeDaoAndVotingWithRole(votesRole, new BN("1"), new BN("1"));
      await veXBE.configure(
        mockXBE.address,
        "Voting Escrowed XBE",
        "veXBE",
        "0.0.1"
      );
      await mockXBE.mint(alice, ether("10000"), { from: alice });
      await mockXBE.approve(veXBE.address, ether("10000"), { from: alice });
      await mockXBE.mint(bob, ether("10000"), { from: bob });
      await mockXBE.approve(veXBE.address, ether("10000"), { from: bob });
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: alice }
      );
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: bob }
      );
      const block = await time.latestBlock();
      aliceStake = await veXBE.balanceOfAt(alice, block);
      bobStake = await veXBE.balanceOfAt(alice, block);
      await votingApp.methods["newVote(bytes,string,bool,bool)"](
        ANY_ADDRESS,
        "string",
        false,
        false,
        { from: alice }
      );
    });
    it("vote: expect revert: not enough veXBE", async () => {
      expectRevert(
        votingApp.vote("0", true, false, { from: owner }),
        "VOTING_CAN_NOT_VOTE"
      );
    });
    it("vote: expect revert: voting is over", async () => {
      await time.increase(new BN("1005000"));
      expectRevert(
        votingApp.vote("0", true, false, { from: alice }),
        "VOTING_CAN_NOT_VOTE"
      );
    });
    it("vote: expect revert", async () => {
      expectRevert(
        votingApp.vote("1", true, true, { from: alice }),
        "VOTING_NO_VOTE"
      );
    });
    it("canVote: expect true", async () => {
      const canVoteTod = await votingApp.canVote.call('0', tod);
      const canVoteAlice = await votingApp.canVote.call('0', alice)
      expect(canVoteTod).to.be.equal(false);
      expect(canVoteAlice).to.be.equal(true);
    });
    it("vote: expect successful", async () => {
      const { logs} = await votingApp.vote("0", false, true, {
        from: bob,
      });
      const { yea, nay } = await votingApp.getVote.call("0");
      const bobState = await votingApp.getVoterState("0", bob);

      expectEvent.inLogs(logs, "CastVote", {
        voteId: "0",
        voter: bob,
        supports: false,
        stake: bobStake,
      });
      expect(yea).to.be.bignumber.equal(new BN("0"));
      expect(nay).to.be.bignumber.equal(bobStake);
      expect(bobState).to.be.bignumber.equal(new BN("2"));
    });
  });
  describe("Execute Vote", () => {
    beforeEach(async () => {
      await initializeDaoAndVotingWithRole(
        votesRole,
        new BN("10").pow(new BN("18")).div(new BN("2")),
        new BN("10").pow(new BN("16")).mul(new BN("0.8"))
      );
      await veXBE.configure(
        mockXBE.address,
        "Voting Escrowed XBE",
        "veXBE",
        "0.0.1"
      );
      await mockXBE.mint(alice, ether("10000"), { from: alice });
      await mockXBE.approve(veXBE.address, ether("10000"), { from: alice });
      await mockXBE.mint(bob, ether("10000"), { from: bob });
      await mockXBE.approve(veXBE.address, ether("10000"), { from: bob });
      await mockXBE.mint(tod, ether("10000"), { from: tod });
      await mockXBE.approve(veXBE.address, ether("10000"), { from: tod });
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: alice }
      );
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("1000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: bob }
      );
      await votingApp.methods["newVote(bytes,string,bool,bool)"](
        "0x0000000200",
        "string",
        false,
        false,
        { from: alice }
      );
    });

    it("execute vote: expect revert - no vote", async () => {
      expectRevert(votingApp.executeVote("1"), "VOTING_NO_VOTE");
    });
    it("execute vote: expect revert - already executed", async () => {
      await votingApp.vote("0", true, false, {
        from: alice,
      });
      await time.increase("1000000000");
      await time.advanceBlock();
      await votingApp.executeVote("0", { from: alice });
      expectRevert(votingApp.executeVote("0"), "VOTING_CAN_NOT_EXECUTE");
    });
    it("execute vote: expect revert - voting is not over", async () => {
      await votingApp.vote("0", false, false, {
        from: bob,
      });
      await votingApp.vote("0", true, false, {
        from: alice,
      });
      expectRevert(votingApp.executeVote("0"), "VOTING_CAN_NOT_EXECUTE");
    });
    it("execute vote: expect revert - not enough support", async () => {
      await votingApp.vote("0", false, false, {
        from: alice,
      });
      await time.increase("1000000000");
      await time.advanceBlock();
      expectRevert(
        votingApp.executeVote("0", { from: alice }),
        "VOTING_CAN_NOT_EXECUTE"
      );
    });
    it("execute vote: expect revert", async () => {
      await time.increase("1000000000");
      await time.advanceBlock();
      expectRevert(
        votingApp.executeVote("0", { from: alice }),
        "VOTING_CAN_NOT_EXECUTE"
      );
    });
    it("execute vote: expect revert - not enough quorum", async () => {
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("10000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: tod }
      );
      await votingApp.methods["newVote(bytes,string,bool,bool)"](
        "0x0000000200",
        "string",
        false,
        false,
        { from: alice }
      );
      await votingApp.vote("1", true, false, {
        from: alice,
      });
      await votingApp.vote("1", true, false, {
        from: bob,
      });
      await time.increase("1000000000");
      await time.advanceBlock();
      expectRevert(
        votingApp.executeVote("1", { from: alice }),
        "VOTING_CAN_NOT_EXECUTE"
      );
    });
    it('canExecute: return true', async () => {
      await votingApp.vote("0", true, true, {
        from: alice,
      });
      await time.increase("1000000000");
      await time.advanceBlock();
      const canExecute = await votingApp.canExecute('0');
      expect(canExecute).to.be.equal(true)
    })
    it("execute vote: expect success", async () => {
      await votingApp.vote("0", true, false, {
        from: alice,
      });
      await votingApp.vote("0", true, false, {
        from: bob,
      });
      await time.increase("1000000000");
      await time.advanceBlock();
      const { logs } = await votingApp.executeVote("0", { from: alice });
      expectEvent.inLogs(logs, "ExecuteVote", {
        voteId: new BN('0'),
      });
    });
    it("execute vote: expect success - early execution", async () => {
      await veXBE.methods["createLock(uint256,uint256)"](
        ether("10000"),
        (await time.latest()).add(time.duration.weeks(2)),
        { from: tod }
      );
      await votingApp.methods["newVote(bytes,string,bool,bool)"](
        scriptForTests,
        "string",
        false,
        true,
        { from: alice }
      );
      await votingApp.vote("1", true, true, {
        from: tod,
      });
      const {
        executed, yea } = await votingApp.getVote.call("1");

      await time.increase("1000000000");
      await time.advanceBlock();
      expect(executed).to.be.equal(true);
    });
    it("execute vote: expect success: repeat vote for", async () => {
      await votingApp.vote("0", true, false, {
        from: alice,
      });
      const aliceStack = await veXBE.balanceOfAt(alice, await time.latestBlock());
      await time.advanceBlock();
      await votingApp.vote("0", false, false, {
        from: alice,
      });
      const {
        yea: yeaAfter,
        nay: nayAfter,
      } = await votingApp.getVote.call("0");
      expect(yeaAfter).to.be.bignumber.equal(new BN('0'))
      expect(nayAfter).to.be.bignumber.closeTo(aliceStack, ether('0.000001'))
    });
    it("execute vote: expect success: repeat vote against", async () => {
      await votingApp.vote("0", false, false, {
        from: alice,
      });
      const aliceStack = await veXBE.balanceOfAt(alice, await time.latestBlock());
      const {
        yea: yeaBefore,
        nay: nayBefore,
            } = await votingApp.getVote.call("0");
      await votingApp.vote("0", true, false, {
        from: alice,
      });
      const {
        yea: yeaAfter,
        nay: nayAfter,
      } = await votingApp.getVote.call("0");
      expect(yeaBefore).to.be.bignumber.equal(new BN('0'))
      expect(yeaAfter).to.be.bignumber.closeTo(aliceStack, ether('0.000001'))
      expect(nayAfter).to.be.bignumber.equal(new BN('0'))
    });
  });
});
