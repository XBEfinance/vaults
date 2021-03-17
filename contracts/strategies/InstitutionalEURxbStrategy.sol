pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./EURxbStrategy.sol";

/// @title InstitutionalEURxbStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
contract InstitutionalEURxbStrategy is EURxbStrategy {

    /// @dev To be realised
    function skim() override external {
        revert("Not implemented");
    }

    /// @dev To be realised
    function deposit() override external {
        revert('Not implemented');
    }

    /// @dev To be realised
    function withdrawalFee() override external view returns(uint256) {
        // return 0;
        revert("Not implemented");
    }

    function _withdrawSome(uint256 _amount) internal override returns(uint) {
        return _amount;
    }

}
