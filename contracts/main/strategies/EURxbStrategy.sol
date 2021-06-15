pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IController.sol";
import "../interfaces/IConverter.sol";
import "../interfaces/vault/IVaultCore.sol";

import "../governance/Governable.sol";

import "../mocks/StringsConcatenations.sol";

/// @title EURxbStrategy
/// @notice This is base contract for yield farming strategy with EURxb token
abstract contract EURxbStrategy is IStrategy, Ownable, Initializable, Context {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event Withdrawn(address indexed _token, uint256 indexed _amount, address indexed _to);

    /// @notice EURxb instance address or wrapper of EURxb instance
    address internal _eurxb;

    /// @notice Controller instance getter, used to simplify controller-related actions
    address public controller;

    /// @notice Vault instance getter, used to simplify vault-related actions
    address public vault;

    /// @dev Prevents other msg.sender than controller address
    modifier onlyController {
        require(_msgSender() == controller, "!controller");
        _;
    }

    /// @dev Prevents other msg.sender than controller or vault addresses
    modifier onlyControllerOrVault {
        require(_msgSender() == controller || _msgSender() == vault, "!controller|vault");
        _;
    }

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _eurxbAddress address of eurxb instance or address of TokenWrapper(EURxb) instance
    /// @param _controllerAddress address of controller instance
    /// @param _vaultAddress address of vault related to this strategy (Link type 1:1)
    function configure(
        address _eurxbAddress,
        address _controllerAddress,
        address _vaultAddress,
        address _governance
    ) initializer external {
        _eurxb = _eurxbAddress;
        controller = _controllerAddress;
        vault = _vaultAddress;
        transferOwnership(_governance);
    }

    /// @notice Usual setter with check if param is new
    /// @param _newVault New value
    function setVault(address _newVault) override onlyOwner external {
        require(vault != _newVault, "!old");
        vault = _newVault;
    }

    /// @notice Usual setter with check if param is new
    /// @param _newController New value
    function setController(address _newController) override onlyOwner external {
        require(controller != _newController, "!old");
        controller = _newController;
    }

    /// @notice Usual setter with check if param is new
    /// @param _newWant New value
    function setWant(address _newWant) override onlyOwner external {
        require(_eurxb != _newWant, "!old");
        _eurxb = _newWant;
    }

    /// @notice Usual getter (inherited from IStrategy)
    /// @return 'want' token (In this case EURxb)
    function want() override external view returns(address) {
        return _eurxb;
    }

    /// @notice must exclude any tokens used in the yield
    /// @dev Controller role - withdraw should return to Controller
    function withdraw(address _token) override onlyController external {
        require(address(_token) != address(_eurxb), "!want");
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(IERC20(_token).transfer(controller, balance), "!transfer");
        emit Withdrawn(_token, balance, controller);
    }

    /// @notice Withdraw partial funds, normally used with a vault withdrawal
    /// @dev Controller | Vault role - withdraw should always return to Vault
    function withdraw(uint256 _amount) override onlyControllerOrVault public {
        uint256 _balance = IERC20(_eurxb).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        address _vault = IController(controller).vaults(_eurxb);
        require(_vault != address(0), "!vault 0"); // additional protection so we don't burn the funds

        address vaultToken = IVaultCore(_vault).token();
        if (vaultToken != _eurxb) {
            address converter = IController(controller).converters(vaultToken, _eurxb);
            require(converter != address(0), "!converter");
            require(IERC20(vaultToken).transfer(converter, _amount), "!transferConverterToken");
            _amount = IConverter(converter).convert(address(this));
        }
        require(IERC20(_eurxb).transfer(_vault, _amount), "!transferVault");
        emit Withdrawn(_eurxb, _amount, _vault);
    }

    /// @dev Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() override onlyControllerOrVault external returns(uint256) {
        uint256 _balance = IERC20(_eurxb).balanceOf(address(this));
        withdraw(_balance);
        return _balance;
    }

    function _withdrawSome(uint256 _amount) virtual internal returns(uint);

    /// @notice balance of this address in "want" tokens
    function balanceOf() override external view returns(uint256) {
        return IERC20(_eurxb).balanceOf(address(this));
    }
}
