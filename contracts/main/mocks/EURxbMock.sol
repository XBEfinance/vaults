pragma solidity ^0.6.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IEURxb.sol";
import "../templates/OverrideERC20.sol";

/**
 * @title EURxb
 * @dev EURxb token
 */
contract EURxbMock is OverrideERC20, IEURxb {
    using SafeMath for uint256;
    using Address for address;

    uint256 private constant UNIT = 10**18;
    uint256 private constant PER_YEAR = 31536000 * 10 ** 18; // UNIT.mul(365).mul(86400);

    uint256 private _countMaturity;
    uint256 private _totalActiveValue;
    uint256 private _annualInterest;
    uint256 private _accrualTimestamp;
    uint256 private _expIndex;

    mapping(address => uint256) private _holderIndex;

    event AddNewMaturityInvoked(uint256 amount, uint256 maturityEnd);
    event RemoveMaturityInvoked(uint256 amount, uint256 maturityEnd);

    constructor() public OverrideERC20("EURxb", "EURxb") {
        _annualInterest = 7 * 10**16;
        _expIndex = UNIT;
        _countMaturity = 100;
    }

    /**
     * @dev Return countMaturity
     */
    function countMaturity() external view returns (uint256) {
        return _countMaturity;
    }

    /**
     * @dev Return totalActiveValue
     */
    function totalActiveValue() external view returns (uint256) {
        return _totalActiveValue;
    }

    /**
     * @dev Return annualInterest
     */
    function annualInterest() external view returns (uint256) {
        return _annualInterest;
    }

    /**
     * @dev Return accrualTimestamp
     */
    function accrualTimestamp() external view returns (uint256) {
        return _accrualTimestamp;
    }

    /**
     * @dev Return expIndex
     */
    function expIndex() external view override returns (uint256) {
        return _expIndex;
    }

    /**
     * @dev Set countMaturity
     * @param count maturity
     */
    function setCountMaturity(uint256 count) external {
        require(count > 0, "The amount must be greater than zero");
        _countMaturity = count;
    }

    /**
     * @dev Mint tokens
     * @param account user address
     * @param amount number of tokens
     */
    function mint(address account, uint256 amount) external override {
        require(account != address(0), "Mint to zero address");
        accrueInterest();
        _updateBalance(account);

        super._mint(account, amount);
    }

    /**
     * @dev Burn tokens
     * @param account user address
     * @param amount number of tokens
     */
    function burn(address account, uint256 amount) external override {
        require(account != address(0), "Burn from zero address");
        accrueInterest();
        _updateBalance(account);

        super._burn(account, amount);
    }

    function addNewMaturity(uint256 amount, uint256 maturityEnd) external override {
        require(amount > 0, "The amount must be greater than zero");
        _totalActiveValue = _totalActiveValue.add(amount);
        emit AddNewMaturityInvoked(amount, maturityEnd);
    }

    function removeMaturity(uint256 amount, uint256 maturityEnd) external override {
        require(amount > 0, "The amount must be greater than zero");
        _totalActiveValue = _totalActiveValue.sub(amount);
        emit RemoveMaturityInvoked(amount, maturityEnd);
    }

    /**
     * @dev Return user balance
     * @param account user address
     */
    function balanceOf(address account) public override(IERC20, OverrideERC20) view returns (uint256) {
        return balanceByTime(account, block.timestamp);
    }

    /**
     * @dev User balance calculation
     * @param account user address
     * @param timestamp date
     */
    function balanceByTime(address account, uint256 timestamp)
        public
        view
        returns (uint256)
    {
        if (super.balanceOf(account) > 0 && _holderIndex[account] > 0) {
            uint256 currentTotalActiveValue = _totalActiveValue;
            uint256 currentExpIndex = _expIndex;
            uint256 currentAccrualTimestamp = _accrualTimestamp;

            currentExpIndex = _calculateInterest(
                timestamp,
                _annualInterest.mul(currentTotalActiveValue),
                currentExpIndex,
                currentAccrualTimestamp
            );
            return super.balanceOf(account).mul(currentExpIndex).div(_holderIndex[account]);
        }
        return super.balanceOf(account);
    }

    /**
     * @dev Calculation of accrued interest
     */
    function accrueInterest() public override {
        _expIndex = _calculateInterest(
            block.timestamp,
            _annualInterest.mul(_totalActiveValue),
            _expIndex,
            _accrualTimestamp
        );
        _accrualTimestamp = block.timestamp;
    }

    /**
     * @dev Calculate interest
     * @param timestampNow the current date
     * @param interest percent
     * @param prevIndex previous index
     */
    function _calculateInterest(
        uint256 timestampNow,
        uint256 interest,
        uint256 prevIndex,
        uint256 lastAccrualTimestamp
    )
        internal
        view
        returns (uint256)
    {
        if (totalSupply() == 0) {
            return prevIndex;
        }

        uint256 period = timestampNow.sub(lastAccrualTimestamp);
        if (period < 60) {
            return prevIndex;
        }

        uint256 interestFactor = interest.mul(period);
        uint256 newExpIndex = (interestFactor.mul(prevIndex).div(PER_YEAR).div(totalSupply()))
            .add(prevIndex);
        return newExpIndex;
    }

    /**
     * @dev Update user balance
     * @param account user address
     */
    function _updateBalance(address account) internal {
        uint256 balance = super.balanceOf(account);
        if (_holderIndex[account] > 0) {
            uint256 newBalance = balance.mul(_expIndex).div(
                _holderIndex[account]
            );
            uint256 delta = newBalance.sub(balance);

            if (delta != 0) {
                super._mint(account, delta);
            }
        }
        _holderIndex[account] = _expIndex;
    }

    /**
     * @dev Transfer tokens
     * @param sender user address
     * @param recipient user address
     * @param amount number of tokens
     */
    function _transfer(address sender, address recipient, uint256 amount) internal override {
        accrueInterest();
        if (sender != address(0)) {
            _updateBalance(sender);
        }
        if (recipient != address(0)) {
            _updateBalance(recipient);
        }
        super._transfer(sender, recipient, amount);
    }
}
