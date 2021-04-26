pragma solidity ^0.6.0;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "../interfaces/IEURxb.sol";

/// @title Bank
/// @notice EURxb Token Exchange Contract
contract Bank is Initializable, ERC20 {
    using SafeMath for uint256;

    /// @notice EURxb token address
    IEURxb public eurxb;

    /// @dev address => deposits
    mapping (address => uint256) private deposits;

    /// @dev address => expIndex
    mapping(address => uint256) private holderIndex;

    event Deposit(address _user, uint256 _amount);
    event Withdraw(address _user, uint256 _amount);
    event WithdrawInterestEUR(address _user, uint256 _amount);
    event WithdrawInterestBank(address _user, uint256 _amount);

    constructor() public ERC20("Banked EURxb", "bEURxb") {}

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _eurxb token address
    function configure(address _eurxb) external initializer {
        eurxb = IEURxb(_eurxb);
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
        address msgSender = _msgSender(); // gas saving
        eurxb.transferFrom(msgSender, address(this), _amount);

        uint256 amountDeposit = deposits[msgSender];

        uint256 expIndex = eurxb.expIndex();

        if (amountDeposit != 0) {
            uint256 newAmountDeposit = amountDeposit.mul(expIndex).div(holderIndex[msgSender]);
            uint256 interest = newAmountDeposit.sub(amountDeposit);
            _amount = _amount.add(interest);
        }

        _mint(msgSender, _amount);
        deposits[msgSender] = deposits[msgSender].add(_amount);
        holderIndex[msgSender] = expIndex;

        emit Deposit(msgSender, _amount);
    }

    /// @notice Method for returning bank tokens and withdrawing a deposit
    /// @param _amount tokens
    function withdraw(uint256 _amount) external {
        require(_amount > 0, "_amount must be greater than zero");
        address msgSender = _msgSender(); // gas saving

        uint256 amountDeposit = deposits[msgSender];
        require(amountDeposit >= _amount, "insufficient balance");

        (uint256 expIndex, uint256 interest) = _accrueInterest(msgSender);

        _burn(msgSender, _amount);
        eurxb.transfer(msgSender, _amount.add(interest));

        deposits[msgSender] = deposits[msgSender].sub(_amount);
        holderIndex[msgSender] = expIndex;

        emit Withdraw(msgSender, _amount);
    }

    /// @notice Method for receiving interest in EURxb tokens
    function withdrawInterestEUR() external {
        address msgSender = _msgSender(); // gas saving
        (uint256 expIndex, uint256 interest) = _accrueInterest(msgSender);

        eurxb.transfer(msgSender, interest);

        holderIndex[msgSender] = expIndex;

        emit WithdrawInterestEUR(msgSender, interest);
    }

    /// @notice Method for receiving interest in Bank tokens
    function withdrawInterestBank() external {
        address msgSender = _msgSender(); // gas saving
        (uint256 expIndex, uint256 interest) = _accrueInterest(msgSender);

        _mint(msgSender, interest);

        deposits[msgSender] = deposits[msgSender].add(interest);
        holderIndex[msgSender] = expIndex;

        emit WithdrawInterestBank(msgSender, interest);
    }

    function _accrueInterest(address _user) internal returns (uint256 expIndex, uint256 interest) {
        uint256 amountDeposit = deposits[_user];

        eurxb.accrueInterest();
        expIndex = eurxb.expIndex();

        uint256 newAmountDeposit = amountDeposit.mul(expIndex).div(holderIndex[_user]);
        interest = newAmountDeposit.sub(amountDeposit);
    }
}
