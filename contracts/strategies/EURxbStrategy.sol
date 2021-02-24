pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IController.sol";

import "../governance/Governable.sol";
import "../templates/Initializable.sol";


contract EURxbStrategy is IStrategy, Governable, Initializable {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address private _eurxb;
    address public controller;
    address public vault;

    modifier onlyController {
        require(_msgSender() == controller, "!controller");
        _;
    }

    modifier onlyControllerOrVault {
        require(_msgSender() == controller || _msgSender() == vault, "!controller|vault");
        _;
    }

    function configure(
      address _eurxbAddress,
      address _controllerAddress,
      address _vaultAddress
    ) initializer external {
        _eurxb = _eurxbAddress;
        controller = _controllerAddress;
        vault = _vaultAddress;
    }

    function setVault(address _newVault) override onlyGovernance external {
        require(vault != _newVault, "!old");
        vault = _newVault;
    }

    function setController(address _newController) override onlyGovernance external {
        require(controller != _newController, "!old");
        controller = _newController;
    }

    function setWant(address _newWant) override onlyGovernance external {
        require(_eurxb != _newWant, "!old");
        _eurxb = _newWant;
    }

    function want() override external view returns(address) {
        return _eurxb;
    }

    function deposit() override external {
        revert('Not implemented');
    }

    // NOTE: must exclude any tokens used in the yield
    // Controller role - withdraw should return to Controller
    function withdraw(address _token) override onlyController external {
        require(address(_token) != address(_eurxb), "!want");
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(IERC20(_token).transfer(controller, balance), "!transfer");
    }

    // Controller | Vault role - withdraw should always return to Vault
    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint256 _amount) override onlyControllerOrVault public {
        uint256 _balance = IERC20(_eurxb).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        address _vault = IController(controller).vaults(_eurxb);
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        require(IERC20(_eurxb).transfer(_vault, _amount), "!transferStrategy");
    }

    // this function is withdraw from business process the difference between balance and requested sum
    function _withdrawSome(uint256 _amount) internal returns(uint) {
        return _amount;
    }

    function skim() override external {
        revert("Not implemented");
    }

    // Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() override onlyControllerOrVault external returns(uint256) {
        uint256 _balance = IERC20(_eurxb).balanceOf(address(this));
        withdraw(_balance);
        return _balance;
    }

    // balance of this address in "want" tokens
    function balanceOf() override external view returns(uint256) {
        return IERC20(_eurxb).balanceOf(address(this));
    }

    function withdrawalFee() override external view returns(uint256) {
        revert("Not implemented");
    }
}
