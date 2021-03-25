pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IExecutor.sol";
import "../governance/Governance.sol";

contract TestExecutor is IExecutor, Initializable {

  using SafeERC20 for IERC20;

  IERC20 public token;
  Governance public governanceContract;

  address public safe;
  address public to;
  uint256 public amount;

  event Executed(address indexed from, address indexed to, address indexed amount);

  function configure(
      address _token,
      address _governance,
      address _safe,
      address _to,
      address _amount
  ) external initializer {
      token = IERC20(_token);
      governanceContract = Governance(_governance);
      safe = _safe;
      to = _to;
      amount = _amount;
  }

  function execute(
      uint256 _id,
      uint256 _for,
      uint256 _against,
      uint256 _quorum
  ) external override {
    if (governanceContract.proposals[_id].end) {
        if (_quorum >= governanceContract.proposals[_id].quorumRequired) {
            if (_for > _against) {
                token.safeTransferFrom(from, to, amount);
                emit Executed(from, to, amount);
            } else {
                if (_for == _against) {
                    revert("For votes equals to against.");
                } else {
                    revert("Against votes are prevail.");
                }
            }
        } else {
            revert("Quorum is not reached!");
        }
    } else {
        revert("Proposal is not ended!");
    }
  }

}
