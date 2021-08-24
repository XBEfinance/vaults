pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./BaseStrategy.sol";
import "../../interfaces/vault/IVaultStakingRewards.sol";
import "../../interfaces/ITreasury.sol";
import "../../interfaces/IVoting.sol";

abstract contract ClaimableStrategy is BaseStrategy {
    function claim(address _rewardToken)
        external
        override
        onlyControllerOrVault
        returns (bool)
    {
        address _vault = IController(controller).vaults(_want);
        require(_vault != address(0), "!vault 0");
        IERC20 token = IERC20(_rewardToken);
        uint256 amount = token.balanceOf(address(this));
        if (amount > 0) {
            token.safeTransfer(_vault, amount);
            IVaultStakingRewards(_vault).notifyRewardAmount(
                _rewardToken,
                amount
            );
            return true;
        }
        return false;
    }
}
