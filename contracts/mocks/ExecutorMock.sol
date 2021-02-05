pragma solidity ^0.6.0;

import "../interfaces/IExecutor.sol";


contract ExecutorMock is IExecutor {
    event ExecutedMock(
        uint256 indexed _id,
        uint256 indexed _for,
        uint256 indexed _against,
        uint256 _quorum
    );

    function execute(
          uint256 _id,
          uint256 _for,
          uint256 _against,
          uint256 _quorum
    ) override external {
      emit ExecutedMock(_id, _for, _against, _quorum);
    }
}
