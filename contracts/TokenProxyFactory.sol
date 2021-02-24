pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./governance/Governable.sol";
import "./templates/Initializable.sol";

contract TokenProxyFactory is Governable, Initializable {

    event Cloned(address _clone);

    address public tokenImpl;

    function configure(address _initialToken) external initializer {
        setNewTokenImpl(_initialToken);
    }

    function setNewTokenImpl(address _newTokenImpl) onlyGovernance public {
        require(tokenImpl != _newTokenImpl, "!old");
        tokenImpl = _newTokenImpl;
    }

    function predictCloneTokenAddress(bytes32 salt) external view returns(address) {
      return Clones.predictDeterministicAddress(tokenImpl, salt);
    }

    function cloneToken(bytes32 salt) onlyGovernance external {
        address _result = Clones.cloneDeterministic(tokenImpl, salt);
        emit Cloned(_result);
    }

}
