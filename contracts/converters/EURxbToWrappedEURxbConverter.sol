// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "../interfaces/IConverter.sol";
import "../interfaces/IStrategy.sol";

import "../TokenWrapper.sol";


contract EURxbToWrappedEURxbConverter is IConverter, Initializable, Context {

    using SafeERC20 for TokenWrapper;

    address public eurxb;

    function configure(address _eurxb) external initializer {
        eurxb = _eurxb;
    }

    function convert(address _strategy) override external returns(uint256) {
        uint256 eurxbBalance = IERC20(eurxb).balanceOf(address(this));
        TokenWrapper wrapper = TokenWrapper(IStrategy(_strategy).want());
        IERC20(eurxb).approve(address(wrapper), eurxbBalance);
        wrapper.mint(eurxbBalance);
        wrapper.safeTransfer(_msgSender(), eurxbBalance);
        return eurxbBalance;
    }
}
