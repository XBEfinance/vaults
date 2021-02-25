 pragma solidity ^0.6.0;


/// @title Governable
/// @dev Governable is contract for governance role. Why don't use an AccessControl? Because the only one member exists
contract Governable {

    /// @notice The government address getter
    address public governance;

    /// @notice Simple contstructor that initialize the governance address
    constructor() public {
        governance = msg.sender;
    }

    /// @dev Prevents other msg.sender than governance address
    modifier onlyGovernance {
        require(msg.sender == governance, "!governance");
        _;
    }

    /// @notice Setter for governance address
    /// @param _newGovernance
    function setGovernance(address _newGovernance) public onlyGovernance {
        governance = _newGovernance;
    }

}
