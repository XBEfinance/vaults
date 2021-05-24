pragma solidity ^0.6.0;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BankV2
/// @notice Bond operations contract
interface IBankV2 is IERC20 {
    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _eurxb token address
    //    function configure(address _eurxb, address _ddp, address _vault) external initializer;

    /// @notice Method for making a 1M EURxb deposit and recieves xbEUR tokens (buying bond).
    //          xbEURO tokens (EURxX amount + upfront interest) are minted to buyer and places xbEUR tokens to Vault.
    //          EURxX are blocked on current contract.
    function deposit(address _eurx, uint256 amount, uint256 timestamp) virtual external;

    //   @notice Method for redeeming the bond that user owns
    function redeemBondInTime(uint256 bondId) virtual external;

    //   @notice Method for redeeming someone else's bond
    function redeemBondExpired(uint256 bondId) virtual external;
}
