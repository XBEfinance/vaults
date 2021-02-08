pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract LPTokenWrapper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public governanceToken;

    function totalSupply() public view returns(uint256) {
        return governanceToken.totalSupply();
    }

    function balanceOf(address _account) public view returns(uint256) {
        return governanceToken.balanceOf(_account);
    }

    function stake(uint256 _amount) public virtual {
        governanceToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(uint256 _amount) public virtual {
        governanceToken.safeTransfer(msg.sender, _amount);
    }

    function _setGovernanceToken(address newGovernanceToken) internal {
        require(address(governanceToken) != newGovernanceToken, "!new");
        governanceToken = IERC20(newGovernanceToken);
    }
}
