pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/ClaimableStrategy.sol";
import "../interfaces/IRewards.sol";

/// @title CVXStrategy
/// @notice CVXVault strategy: in CVX out cvxCRV
contract CVXStrategy is ClaimableStrategy {
    IRewards public cvxRewards;

    function configure(
        address _wantAddress,
        address _controllerAddress,
        address _governance,
        address _cvxRewards
    ) public onlyOwner initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        cvxRewards = IRewards(_cvxRewards);
    }

    /// @dev Function that controller calls
    function deposit() external override onlyController {
        IERC20 wantToken = IERC20(_want);
        uint256 _amount = wantToken.balanceOf(address(this));
        if (wantToken.allowance(address(this), address(cvxRewards)) == 0) {
            wantToken.approve(address(cvxRewards), uint256(-1));
        }
        cvxRewards.stake(_amount);
    }

    function getRewards() external override {
        require(cvxRewards.getReward(), "!getRewards");
    }

    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        require(cvxRewards.withdrawAndUnwrap(_amount, true), "!withdrawSome");
        return _amount;
    }
}
