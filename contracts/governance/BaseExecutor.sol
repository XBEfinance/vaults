pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IExecutor.sol";

abstract contract BaseExecutor is IExecutor {

  using SafeMath for uint256;

  uint256 private constant FIFTY_ONE_PROCENTS = 5100;

  function execute(
      uint256 _id,
      uint256 _for,
      uint256 _against,
      uint256 _quorum
  ) external override {
      if (_for > FIFTY_ONE_PROCENTS && _against < FIFTY_ONE_PROCENTS) {
          _ifPassed(_id, _for, _against, _quorum);
      } else (_for == FIFTY_ONE_PROCENTS && _against == FIFTY_ONE_PROCENTS) {
          _ifStale(_id, _for, _against, _quorum);
      } else {
          _ifNotPassed(_id, _for, _against, _quorum);
      }
  }

  function _ifPassed(
    uint256 _id,
    uint256 _for,
    uint256 _against,
    uint256 _quorum
  ) internal virtual;

  function _ifNotPassed(
    uint256 _id,
    uint256 _for,
    uint256 _against,
    uint256 _quorum
  ) internal virtual;

  function _ifStale(
    uint256 _id,
    uint256 _for,
    uint256 _against,
    uint256 _quorum
  ) internal virtual;
}
