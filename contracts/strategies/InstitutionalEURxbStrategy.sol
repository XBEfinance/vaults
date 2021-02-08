pragma solidity ^0.6.0;

import "../interfaces/IStrategy.sol";
import "../governance/Governable.sol";
import "../templates/Initializable.sol";


contract InstitutionalEURxbStrategy is IStrategy, Governable, Initializable {

    function want() override external view returns(address) {

    }

    function deposit() override external {

    }

    // NOTE: must exclude any tokens used in the yield
    // Controller role - withdraw should return to Controller
    function withdraw(address _token) override external {

    }

    // Controller | Vault role - withdraw should always return to Vault
    function withdraw(uint256 _amount) override external {

    }

    function skim() override external {

    }

    // Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() override external returns(uint256) {

    }

    // balance of this address in "want" tokens
    function balanceOf() override external view returns(uint256) {

    }

    function withdrawalFee() override external view returns(uint256) {

    }
}
