pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "../../interfaces/vault/IVaultCore.sol";
import "../../interfaces/vault/IVaultTransfers.sol";
import "../../interfaces/vault/IVaultDelegated.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/IStrategy.sol";

/// @title EURxbVault
/// @notice Base vault contract, used to manage funds of the clients
contract BaseVault is IVaultCore, IVaultTransfers, Ownable, Initializable, ERC20 {

    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /// @notice Controller instance, to simplify controller-related actions
    IController internal _controller;

    /// @notice Token which will be transfered to strategy and used in business logic
    IERC20 internal _token;

    /// @notice Minimum percentage to be in business? (in base points)
    uint256 public min = 10000;//9500;

    /// @notice Hundred procent (in base points)
    uint256 public constant max = 10000;

    mapping(address => uint256) internal _depositedAmountsOfTokens;

    event Deposit(uint256 indexed _shares);
    event Withdraw(uint256 indexed _amount);

    /// @param typeName Name of the vault token
    /// @param typePrefix Prefix of the vault token
    constructor(string memory typeName, string memory typePrefix)
        public
        ERC20(
            string(abi.encodePacked(typeName, ' xbEURO')),
            string(abi.encodePacked(typePrefix, 'xbEURO'))
        )
        Initializable()
    {}

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _initialToken Business token logic address
    /// @param _initialController Controller instance address
    function _configure(
        address _initialToken,
        address _initialController,
        address _governance
    ) internal {
        _token = IERC20(_initialToken);
        setController(_initialController);
        transferOwnership(_governance);
    }

    /// @notice Usual setter with check if passet param is new
    /// @param _newMin New value
    function setMin(uint256 _newMin) onlyOwner external {
        require(min != _newMin, "!new");
        min = _newMin;
    }

    /// @notice Usual setter with check if passet param is new
    /// @param _newController New value
    function setController(address _newController) public onlyOwner {
        require(address(_controller) != _newController, "!new");
        _controller = IController(_newController);
    }

    /// @notice Returns total balance
    /// @return Balance of the strategy added to balance of the vault in business logic tokens
    function balance() override public view returns(uint256) {
        return _token.balanceOf(address(this)).add(
            IStrategy(
                _controller.strategies(address(_token))
            ).balanceOf()
        );
    }

    /// @notice Custom logic in here for how much the vault allows to be borrowed, sets minimum required on-hand to keep small withdrawals cheap
    function available() public view returns(uint256) {
        return _token.balanceOf(address(this)).mul(min).div(max);
    }

    /// @notice Business logic token getter
    /// @return Business logic token address
    function token() override public view returns(address) {
        return address(_token);
    }

    /// @notice Controller getter
    /// @return Controller address
    function controller() override public view returns(address) {
        return address(_controller);
    }

    /// @notice Exist to calculate price per full share
    /// @return Price of the business logic token per share
    function getPricePerFullShare() override external view returns(uint256) {
        return balance().mul(1e18).div(totalSupply());
    }


    function getDepositedAmount(address who) external view returns(uint256) {
        return _depositedAmountsOfTokens[who];
    }

    function _deposit(address _from, uint256 _amount) internal returns(uint256 shares) {
        if (address(this) != _from) {
            uint256 _before = _token.balanceOf(address(this));
            _token.safeTransferFrom(_from, address(this), _amount);
            uint256 _after = _token.balanceOf(address(this));
            _amount = _after.sub(_before);
        }
        _depositedAmountsOfTokens[_from] = _depositedAmountsOfTokens[_from] + _amount;
        uint256 _pool = balance();
        shares = 0;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount.mul(totalSupply())).div(_pool);
        }
        _mint(_from, shares);
        emit Deposit(shares);
    }

    /// @notice Allows to deposit business logic tokens and reveive vault tokens
    /// @param _amount Amount to deposit business logic tokens
    function deposit(uint256 _amount) override virtual public {
        _deposit(_msgSender(), _amount);
    }

    /// @notice Allows to deposit full balance of the business logic token and reveice vault tokens
    function depositAll() override virtual public {
        _deposit(_msgSender(), _token.balanceOf(_msgSender()));
    }

    function _withdraw(address _to, uint256 _shares) internal returns(uint256 r) {
        // share / totalSupply = r / balance
        // share * balance = r * totalSupply
        // r = share * balance / totalSupply
        r = (balance().mul(_shares)).div(totalSupply());
        _burn(_to, _shares);
        // Check balance
        uint256 b = _token.balanceOf(address(this));
        if (b < r) {
            uint256 _w = r.sub(b);
            _controller.withdraw(address(_token), _w);
            uint256 _after = _token.balanceOf(address(this));
            uint256 _diff = _after.sub(b);
            if (_diff < _w) {
                r = b.add(_diff);
            }
        }
        if (_to != address(this)) {
            _token.safeTransfer(_to, r);
        }
        if (_depositedAmountsOfTokens[_to] > r) {
            _depositedAmountsOfTokens[_to] = _depositedAmountsOfTokens[_to] - r;
        } else {
            _depositedAmountsOfTokens[_to] = 0;
        }
        emit Withdraw(r);
    }

    /// @notice Allows exchange vault tokens to business logic tokens
    /// @param _shares Business logic tokens to withdraw
    function withdraw(uint256 _shares) override virtual public {
        _withdraw(_msgSender(), _shares);
    }

    /// @notice Same as withdraw only with full balance of vault tokens
    function withdrawAll() override virtual public {
        _withdraw(_msgSender(), balanceOf(_msgSender()));
    }

    /// @notice Transfer tokens to controller, controller transfers it to strategy and earn (farm)
    function earn() override external {
        uint256 _bal = available();
        _token.safeTransfer(address(_controller), _bal);
        _controller.earn(address(_token), _bal);
    }
}
