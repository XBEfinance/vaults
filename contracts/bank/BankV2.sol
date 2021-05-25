pragma solidity ^0.6.0;

import "../interfaces/IBankV2.sol";
import "../interfaces/vault/IVaultTransfers.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "smart-bond/contracts/EURxb.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "smart-bond/contracts/templates/Initializable.sol";

contract BankV2 is IBankV2, ERC20, Initializable {
    using SafeMath for uint256;
    EURxb public eurxb;
    address private ddp;
    address private vault;

    mapping(address => uint256) deposits;

    event Deposit(address _user, uint256 _amount);

    constructor() public ERC20("Banked (V2) xbEURO", "xbEURO") {}

    function configure(address _eurxb, address _ddp, address _vault) external initializer {
        eurxb = EURxb(_eurxb);
        ddp = _ddp;
        vault = _vault;
    }

    function setVault(address vault) public {}

    function deposit(address _eurx, uint256 amount, uint256 timestamp) override external {
        require(amount > 0, "BankV2: amount must be greater than 0");
        address msgSender = _msgSender();
        // gas saving

        EURxb(_eurx).transferFrom(msgSender, address(this), amount);

        uint256 xbEUROamount = EURxb(_eurx).balanceByTime(msgSender, timestamp);

        deposits[msgSender] += amount;

        _mint(address(this), xbEUROamount);
        _approve(address(this), vault, xbEUROamount);

        IVaultTransfers(vault).deposit(xbEUROamount);

        emit Deposit(msgSender, amount);
    }

    function redeemBond(uint256 bondId) override external {

    }
}
