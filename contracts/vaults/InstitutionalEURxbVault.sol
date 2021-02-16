pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/vault/IVaultCore.sol";
import "../interfaces/vault/IVaultTransfers.sol";
import "../interfaces/vault/IVaultDelegated.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IController.sol";

import "../governance/Governable.sol";
import "../templates/Initializable.sol";


contract InstitutionalEURxbVault is IVaultCore, IVaultTransfers, IVaultDelegated, Governable, Initializable, ERC20 {

    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address private _controller;
    IERC20 public eurxb;

    // minimum percentage to be in business? (in base points)
    uint256 public min = 9500;

    // hundred procent (in base points)
    uint256 public constant max = 10000;

    constructor()
        public
        ERC20(
            'Institutional EURxb',
            'iEURxb'
        )
        Initializable()
        Governable()
    {}

    function configure(
        address _eurxb,
        address _initialController
    ) external initializer {
        eurxb = IERC20(_eurxb);
        setController(_initialController);
    }

    function setMin(uint256 _newMin) onlyGovernance external {
        require(min != _newMin, "!new");
        min = _newMin;
    }

    function setController(address _newController) public onlyGovernance {
        require(_controller != _newController, "!new");
        _controller = _newController;
    }

    function balance() override public view returns(uint256) {
        return eurxb.balanceOf(address(this)).add(
            IStrategy(
                IController(_controller).strategies(address(eurxb))
            ).balanceOf()
        );
    }

    // Custom logic in here for how much the vault allows to be borrowed
    // Sets minimum required on-hand to keep small withdrawals cheap
    function available() public view returns(uint) {
        return eurxb.balanceOf(address(this)).mul(min).div(max);
    }

    function token() override external view returns(address) {
        return address(this);
    }

    function underlying() override external view returns(address) {
        return address(eurxb);
    }

    function controller() override external view returns(address) {
        return _controller;
    }

    function getPricePerFullShare() override external view returns(uint256) {
        return balance().mul(1e18).div(totalSupply());
    }

    function deposit(uint256 _amount) override public {
        uint256 _pool = balance();
        require(eurxb.transferFrom(_msgSender(), address(this), _amount), "!transferFrom");
        _amount = eurxb.balanceOf(address(this));
        uint256 shares = 0;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount.mul(totalSupply())).div(_pool);
        }
        _mint(_msgSender(), shares);
    }

    function depositAll() override external {
        deposit(eurxb.balanceOf(_msgSender()));
    }

    function withdraw(uint256 _shares) override public {
        uint256 r = (balance().mul(_shares)).div(totalSupply());
        _burn(_msgSender(), _shares);
        // Check balance
        uint256 b = eurxb.balanceOf(address(this));
        if (b < r) {
            uint256 _withdraw = r.sub(b);
            IController(_controller).withdraw(address(eurxb), _withdraw);
            uint256 _after = eurxb.balanceOf(address(this));
            uint256 _diff = _after.sub(b);
            if (_diff < _withdraw) {
                r = b.add(_diff);
            }
        }
        require(eurxb.transfer(_msgSender(), r), "!transfer");
    }

    function withdrawAll() override external {
        withdraw(eurxb.balanceOf(_msgSender()));
    }

    function earn() override external {
      uint256 _bal = available();
      require(eurxb.transfer(_controller, _bal), "!transfer");
      IController(_controller).earn(address(eurxb), _bal);
    }

}
