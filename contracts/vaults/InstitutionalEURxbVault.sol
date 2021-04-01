pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./EURxbVault.sol";
import "../interfaces/IController.sol";
import "../interfaces/IConverter.sol";

/// @title InstitutionalEURxbVault
/// @notice Vault for investors of the system
contract InstitutionalEURxbVault is EURxbVault, AccessControl {

    using SafeERC20 for IERC20;

    bytes32 public constant INVESTOR = keccak256("INVESTOR");

    address public tokenUnwrapped;

    /// @notice Constructor that creates a vault for investors
    constructor() EURxbVault("Institutional", "in") public {
       _setupRole(DEFAULT_ADMIN_ROLE, governance);
    }

    modifier onlyInvestor {
        require(hasRole(INVESTOR, _msgSender()), "!investor");
        _;
    }

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _initialToken Business token logic address
    /// @param _initialController Controller instance address
    function configure(
        address _initialToken,
        address _initialController,
        address _initialTokenUnwrapped
    ) external initializer {
        super.configure(_initialToken, _initialController);
        tokenUnwrapped = _initialTokenUnwrapped;
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

    function _convert(address _from, address _to, uint256 _amount, bool _usingTransferFrom) internal returns(uint256) {
        IController currentController = IController(_controller);
        address converterAddress = currentController.converters(_from, _to);
        require(converterAddress != address(0), "!converter");
        IConverter converter = IConverter(converterAddress);
        if (_usingTransferFrom) {
            IERC20(_from).safeTransferFrom(_msgSender(), converterAddress, _amount);
        } else {
            IERC20(_from).safeTransfer(converterAddress, _amount);
        }
        return converter.convert(currentController.strategies(_to));
    }

    function depositUnwrapped(uint256 _amount) onlyInvestor public {
        deposit(_convert(tokenUnwrapped, address(_token), _amount, true));
    }

    function depositAllUnwrapped() onlyInvestor public {
        depositUnwrapped(IERC20(tokenUnwrapped).balanceOf(_msgSender()));
    }

    function withdrawUnwrapped(uint256 _amount) onlyInvestor public {
        withdraw(_amount);
        uint256 unwrappedAmount = _convert(address(_token), tokenUnwrapped, _amount, false);
        IERC20(tokenUnwrapped).safeTransfer(_msgSender(), unwrappedAmount);
    }

    function withdrawAllUnwrapped() onlyInvestor public {
        withdrawUnwrapped(_token.balanceOf(_msgSender()));
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
