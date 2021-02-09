pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract LPTokenWrapper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public governanceToken;
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;

    function totalSupply() public view returns(uint256) {
        return _totalSupply;
    }

    function balanceOf(address _account) public view returns(uint256) {
        return _balances[_account];
    }

    function stake(uint256 _amount) public virtual {
        _totalSupply = _totalSupply.add(_amount);
        _balances[msg.sender] = _balances[msg.sender].add(_amount);
        governanceToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(uint256 _amount) public virtual {
        _totalSupply = _totalSupply.sub(_amount);
        _balances[msg.sender] = _balances[msg.sender].sub(_amount);
        governanceToken.transfer(msg.sender, _amount);
    }

    function _setGovernanceToken(address newGovernanceToken) internal {
        require(address(governanceToken) != newGovernanceToken, "!new");
        governanceToken = IERC20(newGovernanceToken);
    }
}
