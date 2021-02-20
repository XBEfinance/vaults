pragma solidity ^0.6.0;

import "./EURxbVault.sol";

contract InstitutionalEURxbVault is EURxbVault {
    constructor() EURxbVault("Institutional") public {}
}
