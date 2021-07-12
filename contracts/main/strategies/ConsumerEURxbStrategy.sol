pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./base/BaseStrategy.sol";
import "../TokenWrapper.sol";

/// @title ConsumerEURxbStrategy
/// @notice This is contract for yield farming strategy with EURxb token for consumers
contract ConsumerEURxbStrategy is BaseStrategy {

    using SafeERC20 for IERC20;

    function deposit() override external {
    }

    function _withdrawSome(uint256 _amount) internal override returns(uint) {
        return _amount;
    }


    function canClaimAmount() external override returns(uint256) {
        return 0;
    }

    function claim(address, address[] calldata, uint256[] calldata) external override returns(bool) {
        return false;
    }

    function convertTokens(address, uint256) external override {

    }

    function earned(address[] calldata) external override returns(uint256[] memory) {

    }

    function getRewards() external override {

    }

    function subFee(uint256[] calldata) external override view returns(uint256[] memory) {

    }

}
