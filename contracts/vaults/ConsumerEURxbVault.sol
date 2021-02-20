pragma solidity ^0.6.0;

import "./EURxbVault.sol";

contract ConsumerEURxbVault is EURxbVault {
    constructor() EURxbVault("Consumer") public {}
}
