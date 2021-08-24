pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "../interfaces/IEURxb.sol";

/// @title Bank V2 Mock
/// @notice EURxb Token Exchange Contract
contract BankV2Mock is Initializable, ERC20 {
    using SafeMath for uint256;

    IEURxb public eurxb;
    uint256 public something;

    bool public newInitialized = false;

    constructor() public ERC20("Mocked Banked EURxb V2", "mbEURxbV2") {}

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _eurxb token address
    function newConfigure(address _eurxb, uint256 _something) external {
        require(!newInitialized, "initializedAlready");
        eurxb = IEURxb(_eurxb);
        something = _something;
        newInitialized = true;
    }
}
