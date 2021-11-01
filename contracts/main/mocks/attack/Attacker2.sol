pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../../interfaces/vault/IVaultTransfers.sol";
import "../../interfaces/vault/IVaultStakingRewards.sol";
import "../../interfaces/IVotingStakingRewards.sol";


contract Attacker2 {
    using SafeERC20 for IERC20;

    address public vault;
    IVotingStakingRewards public votingStakingRewards;
    IERC20 public mockLP;

    constructor(
        address _vault,
        IStakingRewards _votingStakingRewards,
        IERC20 _mockLP
    ) public {
        vault = _vault;
        votingStakingRewards = _votingStakingRewards;
        mockLP = _mockLP;
    }

    function attack() external {
        uint256 balanceOfLp = IERC20(vault).balanceOf(address(this));
        IVaultStakingRewards(vault).getReward(false);
        votingStakingRewards.withdrawBondedOrWithPenalty();
    }
}
