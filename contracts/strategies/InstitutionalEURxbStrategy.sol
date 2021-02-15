pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IController.sol";

import "../governance/Governable.sol";
import "../templates/Initializable.sol";


contract InstitutionalEURxbStrategy is IStrategy, Governable, Initializable {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    constructor() Initializable() Governable() public {}

    address private _eurxb;
    address private _controller;

    modifier onlyController {
      require(msg.sender == _controller, "!controller");
      _;
    }

    function configure(
      address _eurxbAddress,
      address _controllerAddress
    ) initializer external {
      _eurxb = _eurxbAddress;
      _controller = _controllerAddress;
    }

    function want() override external view returns(address) {
        return _eurxb;
    }

    function deposit() override external {
        revert("Not implemented");
    }

    // NOTE: must exclude any tokens used in the yield
    // Controller role - withdraw should return to Controller
    function withdraw(address _token) override onlyController external {
        require(address(_token) != address(_eurxb), "!want");
        uint256 balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_controller, balance);
    }

    // Controller | Vault role - withdraw should always return to Vault
    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint256 _amount) override onlyController external {
        uint256 _balance = IERC20(_eurxb).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        address _vault = IController(_controller).vaults(_eurxb);
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        require(IERC20(_eurxb).transfer(_vault, _amount), "!transfer strategy");
    }

    // this function is withdraw from business process the difference between balance and requested sum
    function _withdrawSome(uint256 _amount) internal returns (uint) {
      revert("Not implemented");
    }

    function skim() override external {
        revert("Not implemented");
    }

    // Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() override external returns(uint256) {
        revert("Not implemented");
    }

    // balance of this address in "want" tokens
    function balanceOf() override external view returns(uint256) {
        return IERC20(_eurxb).balanceOf(address(this));
    }

    function withdrawalFee() override external view returns(uint256) {
        revert("Not implemented");
    }
}
