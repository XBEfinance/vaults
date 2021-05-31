pragma solidity ^0.6.0;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @title BankV2
/// @notice Bond operations contract
interface IBankV2 is IERC20, IERC721Receiver {
    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _eurxb token address
    function configure(address _eurxb, address _ddp, address _vault, address _bond) external;

    function setBondHolder(uint256 _bondId, address _owner) external;

    function setVault(address _vault) external;

    /// @notice Method withdrawing funds.
    function withdraw(uint256 _amount) external;

    /// @notice Method for making a 1M EURxb deposit and recieves xbEUR tokens (buying bond).
    //          xbEURO tokens (EURxX amount + upfront interest) are minted to buyer and places xbEUR tokens to Vault.
    //          EURxX are blocked on current contract.
    function deposit(address _eurx, uint256 amount, uint256 timestamp) external;

    //   @notice Method for redeeming the bond
    function redeemBond(uint256 bondId) external;

    //   @notice Method to use instead of EURxX.balanceByTime
    function balanceByTime(address _eurx, uint256 amount, uint256 timestamp) override external;
}
