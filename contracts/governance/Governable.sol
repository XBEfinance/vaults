pragma solidity ^0.6.0;

import "@openzeppelin/contracts/GSN/Context.sol";

/**
 * @title Governable
 * @dev Governable is contract for governance role. Why don't use an AccessControl? Because the members of this role are one.
 */
contract Governable is Context {

    address public governance;

    modifier onlyGovernance() public {
        require(_msgSender() == _governance, "Caller is not a governance address!");
        _;
    }

    function setGovernance(address _newGovernance) public onlyGovernance {
        _governance = _newGovernance;
    }

}
