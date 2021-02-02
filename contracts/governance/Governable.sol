pragma solidity ^0.6.0;

/**
 * @title Governable
 * @dev Governable is contract for governance role. Why don't use an AccessControl? Because the members of this role are one.
 */
contract Governable {

    address public governance;

    modifier onlyGovernance {
        require(msg.sender == governance, "Caller is not a governance address!");
        _;
    }

    function setGovernance(address _newGovernance) public onlyGovernance {
        governance = _newGovernance;
    }

}
