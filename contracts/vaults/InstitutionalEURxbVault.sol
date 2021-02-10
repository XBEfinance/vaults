pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


import "../interfaces/vault/IVaultCore.sol";
import "../interfaces/vault/IVaultTransfers.sol";
import "../interfaces/vault/IVaultBusiness.sol";
import "../interfaces/vault/IVaultDelegated.sol";

import "../governance/Governable.sol";
import "../templates/Initializable.sol";


contract InstitutionalEURxbVault is IVaultCore, IVaultTransfers, IVaultBusiness, IVaultDelegated, Governable, Initializable, ERC20 {

    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address private _controller;

    IERC20 public eurxb;

    constructor()
        public
        ERC20(
            'Institutional EURxb',
            'iEURxb'
        )
        Initializable()
    {}

    function configure(address _eurxb, address _governance, address _controller) external initializer {
        eurxb = IERC20(_eurxb);
        setGovernance(_governance);
        setController(_controller);
        IController(_controller).setVault(_eurxb, address(this));
    }

    function setController(address _newController) public onlyGovernance {
        require(_controller != _newController, '!new');
        _controller = _newController;
    }

    function balance() override public view returns(uint256) {
        return eurxb.balanceOf(address(this)).add(IController(_controller).balanceOf(address(eurxb)));
    }

    function token() override external view returns(address) {
        return address(this);
    }

    function underlying() override external view returns(address) {
        return address(eurxb);
    }

    function controller() override external view returns(address) {
      return _controller;
    }

    function getPricePerFullShare() override external view returns(uint256) {
      return balance().mul(1e18).div(totalSupply());
    }

    function deposit(uint256 _amount) override external {

    }

    function depositAll() override external {

    }

    function withdraw(uint256 _amount) override external {

    }

    function withdrawAll() override external {

    }
}
