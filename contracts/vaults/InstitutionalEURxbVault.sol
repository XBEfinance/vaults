pragma solidity ^0.6.0;

import "../interfaces/IVault.sol";
import "../governance/Governable.sol";
import "../templates/Initializable.sol";


contract InstitutionalEURxbVault is IVault, Governable, Initializable {

    function token() override external view returns(address) {

    }

    function underlying() override external view returns(address) {

    }

    function name() override external view returns(string memory) {

    }

    function symbol() override external view returns(string memory) {

    }

    function decimals() override external view returns(uint8) {

    }

    function controller() override external view returns(address) {

    }

    function getPricePerFullShare() override external view returns(uint256) {

    }

    function deposit(uint256 _amount) override external {

    }

    function depositAll() override external {

    }

    function withdraw(uint256 _amount) override external {

    }

    function withdrawAll() override external {

    }
}
