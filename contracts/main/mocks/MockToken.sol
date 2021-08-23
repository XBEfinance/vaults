pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/minting/IMint.sol";

contract MockToken is ERC20, IMint {

    bool public blockTransfers;
    bool public blockTransfersFrom;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) public ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function setBlockTransfers(bool _block) external {
        blockTransfers = _block;
    }

    function setBlockTransfersFrom(bool _block) external {
        blockTransfersFrom = _block;
    }

    function setBalanceOf(address who, uint256 amount) external {
        uint256 balance = balanceOf(who);
        if (balance > amount) {
            _burn(who, balance - amount);
        } else if (balance < amount) {
            _mint(who, amount - balance);
        }
    }

    function _transfer(address sender, address recipient, uint256 amount)
        internal
        override
    {
        require(!blockTransfers, "blocked");
        super._transfer(sender, recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns(bool) {
        if (blockTransfersFrom) {
          return false;
        }
        return super.transferFrom(sender, recipient, amount);
    }

    function mintSender(uint256 _amount) external {
        _mint(msg.sender, _amount);
    }

    function mint(address account, uint256 amount) override external {
        _mint(account, amount);
    }
}
