pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


/// @title LPTokenWrapper
/// @notice Used as utility to simplify governance token operations in Governance contract
contract LPTokenWrapper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Wrapped governance token
    IERC20 public governanceToken;

    /// @notice Current balances
    mapping(address => uint256) private _balances;

    /// @notice Current total supply
    uint256 private _totalSupply;

    /// @notice Standard totalSupply method
    function totalSupply() public view returns(uint256) {
        return _totalSupply;
    }

    /// @notice Standard balanceOf method
    /// @param _account User address
    function balanceOf(address _account) public view returns(uint256) {
        return _balances[_account];
    }

    /// @notice Standard deposit (stake) method
    /// @param _amount Amount governance tokens to stake (deposit)
    function stake(uint256 _amount) public virtual {
        _totalSupply = _totalSupply.add(_amount);
        _balances[msg.sender] = _balances[msg.sender].add(_amount);
        governanceToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /// @notice Standard withdraw method
    /// @param _amount Amount governance tokens to withdraw
    function withdraw(uint256 _amount) public virtual {
        _totalSupply = _totalSupply.sub(_amount);
        _balances[msg.sender] = _balances[msg.sender].sub(_amount);
        governanceToken.transfer(msg.sender, _amount);
    }

    /// @notice Simple governance setter
    /// @param newGovernanceToken New value
    function _setGovernanceToken(address newGovernanceToken) internal {
        require(address(governanceToken) != newGovernanceToken, "!new");
        governanceToken = IERC20(newGovernanceToken);
    }
}
