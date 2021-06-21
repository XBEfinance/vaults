pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/minting/IMint.sol";

contract MockToken is ERC20, IMint {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) public ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function mintSender(uint256 _amount) external {
        _mint(msg.sender, _amount);
    }

    function mint(address account, uint256 amount) override external {
        _mint(account, amount);
    }
}
