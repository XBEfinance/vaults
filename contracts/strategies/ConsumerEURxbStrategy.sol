pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./EURxbStrategy.sol";
import "../TokenWrapper.sol";

/// @title ConsumerEURxbStrategy
/// @notice This is contract for yield farming strategy with EURxb token for consumers
contract ConsumerEURxbStrategy is EURxbStrategy {

    using SafeERC20 for IERC20;

    /// @dev To be realised
    function skim() override external {
    }

    function deposit() override external {
    }

    /// @dev To be realised
    function withdrawalFee() override external view returns(uint256) {
        return 0;
    }

    function _withdrawSome(uint256 _amount) internal override returns(uint) {
        return _amount;
    }

}
