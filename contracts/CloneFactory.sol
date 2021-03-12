pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./governance/Governable.sol";

/// @title CloneFactory
/// @notice EIP 1167 - allows to reuse different instances of one contract cheaply
contract CloneFactory is Governable {

  /// @notice Emits when clone deployed
  /// @param _clone Clone address
  /// @param _main Address of base contract
    event Cloned(address _clone, address _main);

    /// @notice Used to predict clone address before deployment
    /// @param _impl Base contract
    /// @param _salt Some entropy
    /// @return Predicted address of future clone
    function predictCloneAddress(address _impl, bytes32 _salt)
        external
        view
        returns(address)
    {
        return Clones.predictDeterministicAddress(_impl, _salt);
    }

    /// @notice Deploy clone
    /// @param _impl Base contract
    /// @param _salt Some entropy
    function clone(address _impl, bytes32 _salt) onlyGovernance external {
        address _result = Clones.cloneDeterministic(_impl, _salt);
        emit Cloned(_result, _impl);
    }

}
