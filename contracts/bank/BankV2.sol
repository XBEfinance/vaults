pragma solidity ^0.6.0;

import "../interfaces/IBankV2.sol";
import "../interfaces/vault/IVaultTransfers.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "smart-bond/contracts/EURxb.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "smart-bond/contracts/templates/Initializable.sol";
import "smart-bond/contracts/SecurityAssetToken.sol";
import "smart-bond/contracts/DDP.sol";
import "smart-bond/contracts/BondToken.sol";

contract BankV2 is IBankV2, ERC20, Initializable {
    using SafeMath for uint256;
    EURxb public eurxb;
    DDP private ddp;
    BondToken private bond;
    address private vault;
    SecurityAssetToken private sat;

    mapping(address => uint256) deposits;

    event Deposit(address _user, uint256 _amount);

    constructor() public ERC20("Banked (V2) xbEURO", "xbEURO") {}

    function configure(address _eurxb, address _ddp, address _vault, address _sat, address _bond) external initializer {
        eurxb = EURxb(_eurxb);
        ddp = DDP(_ddp);
        vault = _vault;
        sat = SecurityAssetToken(_sat);
        bond = BondToken(_bond);
    }

    function setVault(address vault) public {}

    function deposit(address _eurx, uint256 amount, uint256 timestamp) override external {
        require(amount > 0, "BankV2: amount < 0");
        address msgSender = _msgSender();   // gas saving

        EURxb(_eurx).transferFrom(msgSender, address(this), amount);

        uint256 xbEUROamount = EURxb(_eurx).balanceByTime(msgSender, timestamp);

        deposits[msgSender] += deposits[msgSender].add(amount);

        _mint(address(this), xbEUROamount);
        _approve(address(this), vault, xbEUROamount);

        IVaultTransfers(vault).deposit(xbEUROamount);

        emit Deposit(msgSender, amount);
    }

    function redeemBond(uint256 bondId) override external {
        (, , maturity) = bond.getTokenInfo(bondId);
        require(block.timestamp > maturity, "BankV2: bond is not mature yet");

        address msgSender = _msgSender();   // gas saving
        uint256 endPeriod = maturity.add(ddp.getClaimPeriod());
        if (msgSender != sat.ownerOf(bondId)) {
            require(block.timestamp > endPeriod, "BankV2: claim period is not finished yet");
        }
        ddp.withdraw(bondId);

    }
}
