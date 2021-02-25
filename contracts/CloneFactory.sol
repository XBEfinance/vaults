pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./governance/Governable.sol";

/// @title CloneFactory
/// @notice
/// @dev
contract CloneFactory is Governable {

    event Cloned(address _clone, address _main);

    /// @notice
    /// @dev
    /// @param _impl
    /// @param _salt
    /// @return
    function predictCloneAddress(address _impl, bytes32 _salt)
        external
        view
        returns(address)
    {
        return Clones.predictDeterministicAddress(_impl, _salt);
    }

    /// @notice
    /// @dev
    /// @param _impl
    /// @param _salt
    /// @return
    function clone(address _impl, bytes32 _salt) onlyGovernance external {
        address _result = Clones.cloneDeterministic(_impl, _salt);
        emit Cloned(_result, _impl);
    }

}
