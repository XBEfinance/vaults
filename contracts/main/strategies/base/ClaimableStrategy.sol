pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./BaseStrategy.sol";
import "../../interfaces/vault/IVaultStakingRewards.sol";
import "../../interfaces/ITreasury.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IVoting.sol";

abstract contract ClaimableStrategy is BaseStrategy {
    function earned(address[] calldata _tokens)
        external
        view
        override
        returns (uint256[] memory _amounts)
    {
        _amounts = new uint256[](_tokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            _amounts[i] = IERC20(_tokens[i]).balanceOf(address(this));
        }
    }

    function claim(address _rewardToken)
        external
        override
        onlyControllerOrVault
        returns (bool)
    {
        address _vault = IController(controller).vaults(_want);
        require(_vault != address(0), "!vault 0");
        IERC20 token = IERC20(_rewardToken);
        uint256 rewardForEveryone = token.balanceOf(address(this));
        if (rewardForEveryone > 0) {
            token.safeTransfer(_vault, rewardForEveryone);
            IVaultStakingRewards(_vault).notifyRewardAmount(
                _rewardToken,
                rewardForEveryone
            );
            return true;
        }
        return false;
    }
}
