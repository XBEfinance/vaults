pragma solidity ^0.6.0;

import "../interfaces/IController.sol";
import "../governance/Governable.sol";
import "../templates/Initializable.sol";

contract InstitutionalEURxbController is IController, Governable, Initializable {

    function withdraw(address _token, uint256 _amount) override external {

    }

    function balanceOf(address _someone) override external view returns(uint256) {

    }

    function earn(address _token, uint256 _amount) override external {

    }

    function want(address _token) override external view returns(address) {

    }

    function rewards() override external view returns(address) {

    }

    function vaults(address _token) override external view returns(address) {

    }

    function strategies(address _token) override external view returns(address) {

    }

    function approvedStrategies(address _token, address _strategy) override external view returns(bool) {

    }
}
