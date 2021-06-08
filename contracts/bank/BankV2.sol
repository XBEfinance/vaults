pragma solidity ^0.6.0;

import "../interfaces/IBankV2.sol";
import "../interfaces/IDDP.sol";
import "../interfaces/vault/IVaultTransfers.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "smart-bond/contracts/EURxb.sol";
import "smart-bond/contracts/templates/Initializable.sol";
import "smart-bond/contracts/interfaces/IBondToken.sol";
import "smart-bond/contracts/interfaces/ISecurityAssetToken.sol";

contract BankV2 is IBankV2, ERC721Holder, ERC20, Initializable, Ownable {
    using SafeMath for uint256;
    address public vault;

    mapping(address => uint256) public xbEUROvault; // (owner => xbeuro_in_vault_amount)
    mapping(address => mapping(uint256 => address)) public bondOwner; // (bondContractAddress => (bondId => owner))
    mapping(address => address) public bondDDP; // (bondContractAddress => DDP)

    event Deposit(address _user, uint256 _amount);
    event Withdraw(address _user, uint256 _amount);

    constructor() public ERC20("Banked (V2) xbEURO", "xbEURO") {}

    function configure(address _vault) override external initializer onlyOwner {
        vault = _vault;
    }

    function setBondDDP(address bond, address _ddp) override external onlyOwner {
        bondDDP[bond] = _ddp;
    }

    function setBondHolder(address bondAddress, uint256 _bondId, address _owner) override external onlyOwner {
        bondOwner[bondAddress][_bondId] = _owner;
    }

    function setVault(address _vault) override public onlyOwner {
        vault = _vault;
    }

    function deposit(address _eurx, uint256 amount, uint256 timestamp) override external {
        require(amount > 0, "BankV2: amount < 0");
        address msgSender = _msgSender();        // gas saving
        EURxb eurx = EURxb(_eurx);        // gas saving

        uint256 xbEUROamount = eurx.balanceByTime(msgSender, timestamp);
        xbEUROamount = xbEUROamount.mul(amount).div(eurx.balanceOf(msgSender));
        eurx.transferFrom(msgSender, address(this), amount);
        xbEUROvault[msgSender] = xbEUROvault[msgSender].add(xbEUROamount);
        _mint(address(this), xbEUROamount);
        _approve(address(this), vault, xbEUROamount);
        IVaultTransfers(vault).deposit(xbEUROamount);

        emit Deposit(msgSender, amount);
    }

    function withdraw(uint256 _amount) override external {
        address msgSender = _msgSender();                   // gas saving
        uint256 _xbEUROavailable = xbEUROvault[msgSender];  // gas saving

        require(_amount > 0, "BankV2: amount < 0");
        require(_xbEUROavailable >= _amount, "BankV2: not enough funds");
        IVaultTransfers(vault).withdraw(_amount);
        xbEUROvault[msgSender] = _xbEUROavailable.sub(_amount);
        _transfer(address(this), msgSender, _amount);

        emit Withdraw(msgSender, _amount);
    }

    function redeemBond(address bondAddress, uint256 bondId) override external {
        (uint256 tokenValue,, uint256 maturity) = IBondToken(bondAddress).getTokenInfo(bondId);

        address msgSender = _msgSender();        // gas saving
        IDDP _ddp = IDDP(bondDDP[bondAddress]);        // gas saving

        uint256 endPeriod = maturity.add(_ddp.getClaimPeriod());
        if (msgSender != bondOwner[bondAddress][bondId]) {
            require(block.timestamp > endPeriod, "BankV2: claim period is not finished yet");
        }

        _ddp.withdraw(bondId);
        _burn(msgSender, tokenValue);
    }
}
