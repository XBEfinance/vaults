pragma solidity ^0.6.0;

import "../interfaces/IBankV2.sol";
import "../interfaces/IDDP.sol";
import "../interfaces/vault/IVaultTransfers.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "smart-bond/contracts/EURxb.sol";
import "smart-bond/contracts/templates/Initializable.sol";
import "smart-bond/contracts/interfaces/IBondToken.sol";

contract BankV2 is IBankV2, ERC20, Initializable, Ownable {
    using SafeMath for uint256;
    EURxb public eurxb;
    IDDP public ddp;
    IBondToken public bond;
    address public vault;

    mapping(address => uint256) public xbEUROvault; // (owner => xbeuro_in_vault_amount)
    mapping(uint256 => address) public bondOwner; // (bondId => owner)

    event Deposit(address _user, uint256 _amount);
    event Withdraw(address _user, uint256 _amount);

    constructor() public ERC20("Banked (V2) xbEURO", "xbEURO") {}

    function configure(address _eurxb, address _ddp, address _vault, address _bond) override external initializer {
        eurxb = EURxb(_eurxb);
        ddp = IDDP(_ddp);
        vault = _vault;
        bond = IBondToken(_bond);
    }

    function setBondHolder(uint256 _bondId, address _owner) override external onlyOwner {
        bondOwner[_bondId] = _owner;
    }

    function setVault(address _vault) override public onlyOwner {
        vault = _vault;
    }

    function deposit(address _eurx, uint256 amount, uint256 timestamp) override external {
        require(amount > 0, "BankV2: amount < 0");
        address msgSender = _msgSender(); // gas saving

        EURxb(_eurx).transferFrom(msgSender, address(this), amount);

        uint256 xbEUROamount = EURxb(_eurx).balanceByTime(msgSender, timestamp);

        xbEUROvault[msgSender] += xbEUROvault[msgSender].add(xbEUROamount);

        _mint(address(this), xbEUROamount);
        _approve(address(this), vault, xbEUROamount);

        IVaultTransfers(vault).deposit(xbEUROamount);

        emit Deposit(msgSender, amount);
    }

    function withdraw(uint256 _amount) override external {
        address msgSender = _msgSender(); // gas saving
        require(_amount > 0, "BankV2: amount < 0");
        require(xbEUROvault[msgSender] > _amount, "BankV2: not enough funds");
        IVaultTransfers(vault).withdraw(_amount);
        _transfer(address(this), msgSender, _amount);
    }

    function redeemBond(uint256 bondId) override external {
        (uint256 tokenValue, , uint256 maturity) = bond.getTokenInfo(bondId);
        require(block.timestamp > maturity, "BankV2: bond is not mature yet");

        address msgSender = _msgSender(); // gas saving
        uint256 endPeriod = maturity.add(ddp.getClaimPeriod());
        if (msgSender != bondOwner[bondId]) {
            require(block.timestamp > endPeriod, "BankV2: claim period is not finished yet");
        }
        ddp.withdraw(bondId);
        _burn(msgSender, tokenValue);
    }
}
