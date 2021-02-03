pragma solidity ^0.6.0;


/**
 * @title Governable
 * @dev Governable is contract for governance role. Why don't use an AccessControl? Because the members of this role are one.
 */
contract Governable {

    address public governance;

    constructor() public {
        governance = msg.sender;
    }

    modifier onlyGovernance {
        require(msg.sender == governance, "!governance");
        _;
    }

    function setGovernance(address _newGovernance) public onlyGovernance {
        governance = _newGovernance;
    }

}
