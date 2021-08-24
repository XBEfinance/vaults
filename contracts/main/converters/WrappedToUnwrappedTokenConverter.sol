// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "../interfaces/IConverter.sol";
import "../interfaces/IStrategy.sol";

import "../TokenWrapper.sol";

contract WrappedToUnwrappedTokenConverter is IConverter, Initializable {
    using SafeERC20 for IERC20;

    address public token;

    function configure(address _token) external initializer {
        token = _token;
    }

    function convert(address _strategy) external override returns (uint256) {
        TokenWrapper wrapper = TokenWrapper(IStrategy(_strategy).want());
        uint256 wrappedtokenBalance = wrapper.balanceOf(address(this));
        wrapper.burn(wrappedtokenBalance);
        IERC20(token).safeTransfer(msg.sender, wrappedtokenBalance);
        return wrappedtokenBalance;
    }
}
