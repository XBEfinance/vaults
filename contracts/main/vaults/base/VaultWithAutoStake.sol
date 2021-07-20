pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../../interfaces/IVoting.sol";

/// @title WithReferalProgramVault
/// @notice Vault for consumers of the system
abstract contract VaultWithAutoStake {

    using SafeERC20 for IERC20;

    address public votingStakingRewards;
    address public tokenToAutostake;

    function _configureVaultWithAutoStake(
        address _tokenToAutostake,
        address _votingStakingRewards
    ) internal {
        votingStakingRewards = _votingStakingRewards;
        tokenToAutostake = _tokenToAutostake;
    }

    function _autoStakeForOrSendTo(
        address _token,
        uint256 _amount,
        address _receiver
    ) internal {
        if (_token == tokenToAutostake) {
            IERC20(_token).approve(votingStakingRewards, _amount);
            IVoting(votingStakingRewards).stakeFor(_receiver, _amount);
        } else {
            IERC20(_token).safeTransfer(_receiver, _amount);
        }
    }
}
