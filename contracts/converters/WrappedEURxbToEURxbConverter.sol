// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "../interfaces/IConverter.sol";
import "../interfaces/IStrategy.sol";

import "../TokenWrapper.sol";


contract WrappedEURxbToEURxbConverter is IConverter, Initializable, Context {

    using SafeERC20 for IERC20;

    address public eurxb;

    function configure(address _eurxb) external initializer {
        eurxb = _eurxb;
    }

    function convert(address _strategy) override external returns(uint256) {
        TokenWrapper wrapper = TokenWrapper(IStrategy(_strategy).want());
        uint256 wrappedEURxbBalance = wrapper.balanceOf(address(this));
        wrapper.burn(wrappedEURxbBalance);
        IERC20(eurxb).safeTransfer(_msgSender(), wrappedEURxbBalance);
        return wrappedEURxbBalance;
    }
}
