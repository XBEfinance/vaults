pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../../interfaces/vault/IVaultTransfers.sol";
import "../../interfaces/vault/IVaultStakingRewards.sol";
import "../../interfaces/IVotingStakingRewards.sol";
import "./Attacker2.sol";


contract Attacker1 {
    using SafeERC20 for IERC20;

    address public vault;
    IVotingStakingRewards public votingStakingRewards;
    IERC20 public mockLP;

    Attacker2 public attacker2;

    constructor(
        address _vault,
        IStakingRewards _votingStakingRewards,
        IERC20 _mockLP,
        Attacker2 _attacker2
    ) public {
        vault = _vault;
        votingStakingRewards = _votingStakingRewards;
        mockLP = _mockLP;
        attacker2 = _attacker2;
    }

    function depositForAttack(uint256 _amount) external {
        mockLP.safeTransferFrom(msg.sender, address(this), _amount);
        mockLP.approve(vault, _amount);
        IVaultTransfers(vault).deposit(_amount);
    }

    function attack(uint256 _amount) external {
        IVaultStakingRewards(vault).getReward(false);
        votingStakingRewards.withdrawBondedOrWithPenalty();
        IERC20(vault).safeTransfer(address(attacker2), _amount);
        attacker2.attack();
    }
}
