pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./EURxbVault.sol";

/// @title InstitutionalEURxbVault
/// @notice Vault for investors of the system
contract InstitutionalEURxbVault is EURxbVault, AccessControl {

    bytes32 public constant INVESTOR = keccak256("INVESTOR");

    /// @notice Constructor that creates a vault for investors
    constructor() EURxbVault("Institutional", "in") public {
       _setupRole(DEFAULT_ADMIN_ROLE, governance);
    }

    modifier onlyInvestor {
        require(hasRole(INVESTOR, _msgSender()), "!investor");
        _;
    }

    function allowInvestor(address _investor) external onlyGovernance {
        grantRole(INVESTOR, _investor);
    }

    function disallowInvestor(address _investor) external onlyGovernance {
        revokeRole(INVESTOR, _investor);
    }

    function renounceInvestor() external {
        renounceRole(INVESTOR, _msgSender());
    }

    /// @notice Allows to deposit business logic tokens and reveive vault tokens
    /// @param _amount Amount to deposit business logic tokens
    function deposit(uint256 _amount) override onlyInvestor public {
        super.deposit(_amount);
    }

    /// @notice Allows to deposit full balance of the business logic token and reveice vault tokens
    function depositAll() override onlyInvestor public {
        super.depositAll();
    }

    /// @notice Allows exchange vault tokens to business logic tokens
    /// @param _shares Business logic tokens to withdraw
    function withdraw(uint256 _shares) override onlyInvestor public {
        super.withdraw(_shares);
    }

    /// @notice Same as withdraw only with full balance of vault tokens
    function withdrawAll() override onlyInvestor public {
        super.withdrawAll();
    }


}
