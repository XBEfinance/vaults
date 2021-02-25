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


/// @title EURxbVault
/// @notice
/// @dev
contract EURxbVault is IVaultCore, IVaultTransfers, Governable, Initializable, ERC20 {

    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /// @notice
    address private _controller;
    /// @notice
    IERC20 private _token;

    /// @notice minimum percentage to be in business? (in base points)
    uint256 public min = 9500;

    /// @notice hundred procent (in base points)
    uint256 public constant max = 10000;

    /// @notice
    /// @dev
    /// @param typeName
    /// @return
    constructor(string memory typeName)
        public
        ERC20(
            string(abi.encodePacked(typeName, ' EURxb')),
            'iEURxb'
        )
        Initializable()
        Governable()
    {}

    /// @notice
    /// @dev
    /// @param _initialToken
    /// @param _initialController
    /// @return
    function configure(
        address _initialToken,
        address _initialController
    ) external initializer {
        _token = IERC20(_initialToken);
        setController(_initialController);
    }

    /// @notice
    /// @dev
    /// @param _newMin
    /// @return
    function setMin(uint256 _newMin) onlyGovernance external {
        require(min != _newMin, "!new");
        min = _newMin;
    }

    /// @notice
    /// @dev
    /// @param _newController
    /// @return
    function setController(address _newController) public onlyGovernance {
        require(_controller != _newController, "!new");
        _controller = _newController;
    }

    /// @notice
    /// @dev
    /// @return
    function balance() override public view returns(uint256) {
        return _token.balanceOf(address(this)).add(
            IStrategy(
                IController(_controller).strategies(address(_token))
            ).balanceOf()
        );
    }

    // Custom logic in here for how much the vault allows to be borrowed
    // Sets minimum required on-hand to keep small withdrawals cheap
    function available() public view returns(uint) {
        return _token.balanceOf(address(this)).mul(min).div(max);
    }

    /// @notice
    /// @dev
    /// @return
    function token() override external view returns(address) {
        return address(_token);
    }

    /// @notice
    /// @dev
    /// @return
    function controller() override external view returns(address) {
        return _controller;
    }

    /// @notice
    /// @dev
    /// @return
    function getPricePerFullShare() override external view returns(uint256) {
        return balance().mul(1e18).div(totalSupply());
    }

    /// @notice
    /// @dev
    /// @param _amount
    /// @return
    function deposit(uint256 _amount) override public {
        uint256 _pool = balance();
        require(_token.transferFrom(_msgSender(), address(this), _amount), "!transferFrom");
        _amount = _token.balanceOf(address(this));
        uint256 shares = 0;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount.mul(totalSupply())).div(_pool);
        }
        _mint(_msgSender(), shares);
    }

    /// @notice
    /// @dev
    /// @return
    function depositAll() override external {
        deposit(_token.balanceOf(_msgSender()));
    }

    /// @notice
    /// @dev
    /// @param _shares
    /// @return
    function withdraw(uint256 _shares) override public {
        uint256 r = (balance().mul(_shares)).div(totalSupply());
        _burn(_msgSender(), _shares);
        // Check balance
        uint256 b = _token.balanceOf(address(this));
        if (b < r) {
            uint256 _withdraw = r.sub(b);
            IController(_controller).withdraw(address(_token), _withdraw);
            uint256 _after = _token.balanceOf(address(this));
            uint256 _diff = _after.sub(b);
            if (_diff < _withdraw) {
                r = b.add(_diff);
            }
        }
        require(_token.transfer(_msgSender(), r), "!transfer");
    }

    /// @notice
    /// @dev
    /// @return
    function withdrawAll() override external {
        withdraw(_token.balanceOf(_msgSender()));
    }

    /// @notice
    /// @dev
    /// @return
    function earn() override external {
      uint256 _bal = available();
      require(_token.transfer(_controller, _bal), "!transfer");
      IController(_controller).earn(address(_token), _bal);
    }

}
