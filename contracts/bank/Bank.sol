pragma solidity ^0.6.0;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "../interfaces/IEURxb.sol";

/// @title Bank
/// @notice EURxb Token Exchange Contract
contract Bank is Context, Initializable, ERC20 {
    using SafeMath for uint256;

    /// @notice EURxb token address
    address public eurxb;

    /// @dev address => deposits
    mapping (address => uint256) private deposits;

    /// @dev address => expIndex
    mapping(address => uint256) private holderIndex;

    event Deposit(address _user, uint256 _amount);
    event Withdraw(address _user, uint256 _amount);
    event WithdrawInterestEUR(address _user, uint256 _amount);
    event WithdrawInterestBank(address _user, uint256 _amount);

    constructor() public ERC20("bEURxb", "bEURxb") {}

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _eurxb token address
    function configure(address _eurxb) external initializer {
        eurxb = _eurxb;
    }

    /// @notice Used to receive user deposits
    /// @return User deposits
    function getDeposit(address user) external view returns(uint256) {
        return deposits[user];
    }

    /// @notice Used to get the user's index
    /// @return User index
    function getIndex(address user) external view returns(uint256) {
        return holderIndex[user];
    }

    /// @notice Method for making a deposit and receiving bank tokens
    /// @param _amount tokens
    function deposit(uint256 _amount) external {
        require(_amount > 0, "_amount must be greater than zero");
        uint256 amountDeposit = deposits[_msgSender()];

        IEURxb(eurxb).accrueInterest();
        uint256 expIndex = IEURxb(eurxb).expIndex();

        if (amountDeposit != 0) {
            uint256 newAmountDeposit = amountDeposit.mul(expIndex).div(holderIndex[_msgSender()]);
            uint256 interest = newAmountDeposit.sub(amountDeposit);
            _amount = _amount.add(interest);
        }

        _mint(_msgSender(), _amount);
        IERC20(eurxb).transferFrom(_msgSender(), address(this), _amount);

        deposits[_msgSender()] = deposits[_msgSender()].add(_amount);
        holderIndex[_msgSender()] = expIndex;

        emit Deposit(_msgSender(), _amount);
    }

    /// @notice Method for returning bank tokens and withdrawing a deposit
    /// @param _amount tokens
    function withdraw(uint256 _amount) external {
        require(_amount > 0, "_amount must be greater than zero");

        uint256 amountDeposit = deposits[_msgSender()];
        require(amountDeposit > 0, "there is no deposit in the bank");

        if (_amount > amountDeposit) {
            _amount = amountDeposit;
        }

        IEURxb(eurxb).accrueInterest();
        uint256 expIndex = IEURxb(eurxb).expIndex();

        uint256 newAmountDeposit = amountDeposit.mul(expIndex).div(holderIndex[_msgSender()]);
        uint256 interest = newAmountDeposit.sub(amountDeposit);

        _burn(_msgSender(), _amount);
        IERC20(eurxb).transfer(_msgSender(), _amount.add(interest));

        deposits[_msgSender()] = deposits[_msgSender()].sub(_amount);
        holderIndex[_msgSender()] = expIndex;

        emit Withdraw(_msgSender(), _amount);
    }

    /// @notice Method for receiving interest in EURxb tokens
    function withdrawInterestEUR() external {
        uint256 amountDeposit = deposits[_msgSender()];

        IEURxb(eurxb).accrueInterest();
        uint256 expIndex = IEURxb(eurxb).expIndex();

        uint256 newAmountDeposit = amountDeposit.mul(expIndex).div(holderIndex[_msgSender()]);
        uint256 interest = newAmountDeposit.sub(amountDeposit);

        IERC20(eurxb).transfer(_msgSender(), interest);

        holderIndex[_msgSender()] = expIndex;

        emit WithdrawInterestEUR(_msgSender(), interest);
    }

    /// @notice Method for receiving interest in Bank tokens
    function withdrawInterestBank() external {
        uint256 amountDeposit = deposits[_msgSender()];

        IEURxb(eurxb).accrueInterest();
        uint256 expIndex = IEURxb(eurxb).expIndex();

        uint256 newAmountDeposit = amountDeposit.mul(expIndex).div(holderIndex[_msgSender()]);
        uint256 interest = newAmountDeposit.sub(amountDeposit);

        _mint(_msgSender(), interest);

        deposits[_msgSender()] = deposits[_msgSender()].add(interest);
        holderIndex[_msgSender()] = expIndex;

        emit WithdrawInterestBank(_msgSender(), interest);
    }
}