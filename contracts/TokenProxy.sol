pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "./governance/Governable.sol";
import "./templates/Initializable.sol";

contract TokenProxy is Governable, Initializable, Proxy {

    address private _token;

    function configure(address _initialToken) external initializer {
        setToken(_initialToken);
    }

    function setToken(address _newToken) onlyGovernance public {
        require(_token != _newToken, "!old");
        _token = _newToken;
    }

    function _implementation() override internal view returns(address) {
        return _token;
    }

}
