pragma solidity ^0.6.0;

import "@openzeppelin/upgrades/contracts/upgradeability/ProxyFactory.sol";
import "./governance/Governable.sol";
import "./templates/Initializable.sol";

contract TokenProxyFactory is Governable, Initializable, ProxyFactory {

    address public tokenImpl;

    function configure(address _initialToken) external initializer {
        setNewTokenImpl(_initialToken);
    }

    function setNewTokenImpl(address _newTokenImpl) onlyGovernance public {
        require(tokenImpl != _newTokenImpl, "!old");
        tokenImpl = _newTokenImpl;
    }

    function cloneToken() onlyGovernance public returns(address) {
        return deployMinimal(tokenImpl, "");
    }

}
