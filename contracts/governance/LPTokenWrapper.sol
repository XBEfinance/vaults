pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract LPTokenWrapper {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => uint256) private _balances;

    IERC20 public governanceToken;
    uint256 private _totalSupply;

    function _setGovernanceToken(address newGovernanceToken) internal {
        require(address(governanceToken) != newGovernanceToken,
            "A new governance token must differ from the old.");
        governanceToken = IERC20(newGovernanceToken)
    }

    function totalSupply() public view returns(uint256) {
        return _totalSupply;
    }

    function balanceOf(address _account) public view returns(uint256) {
        return _balances[account];
    }

    function stake(uint256 _amount) public {
        _totalSupply = _totalSupply.add(_amount);
        _balances[msg.sender] = _balances[msg.sender].add(_amount);
        governanceToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(uint256 _amount) public {
        _totalSupply = _totalSupply.sub(_amount);
        _balances[msg.sender] = _balances[msg.sender].sub(_amount);
        governanceToken.safeTransfer(msg.sender, _amount);
    }
}
