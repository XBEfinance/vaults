// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "../interfaces/IConverter.sol";
import "../interfaces/IStrategy.sol";

import "../TokenWrapper.sol";

contract UnwrappedToWrappedTokenConverter is IConverter, Initializable {
    using SafeERC20 for TokenWrapper;

    address public token;

    function configure(address _token) external initializer {
        token = _token;
    }

    function convert(address _strategy) external override returns (uint256) {
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        TokenWrapper wrapper = TokenWrapper(IStrategy(_strategy).want());
        IERC20(token).approve(address(wrapper), tokenBalance);
        wrapper.mint(tokenBalance);
        wrapper.safeTransfer(msg.sender, tokenBalance);
        return tokenBalance;
    }
}
