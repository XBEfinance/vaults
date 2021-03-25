pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IExecutor.sol";

contract TestExecutor is IExecutor, Initializable {

  using SafeERC20 for IERC20;

  IERC20 public token;
  address public to;

  event Executed(address indexed to, uint256 indexed amount);

  function configure(
      address _token,
      address _to
  ) external initializer {
      token = IERC20(_token);
      to = _to;
  }

  function execute(
      uint256 _id,
      uint256 _for,
      uint256 _against,
      uint256 _quorum
  ) external override {
      uint256 amount = token.balanceOf(address(this));
      token.safeTransfer(to, amount);
      emit Executed(to, amount);
  }

}
