pragma solidity ^0.6.0;

import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


/// @title TokenWrapper
/// @notice local wrapper for mediocre purposes only
contract TokenWrapper is ERC20PresetMinterPauser, Initializable {

  using SafeERC20 for IERC20;

  address public wrappedToken;

  modifier onlyMinter {
    require(hasRole(MINTER_ROLE, _msgSender()), "!minter");
    _;
  }

  constructor () public ERC20PresetMinterPauser("TokenWrapper", "TW") {}

  function configure(address _wrappedToken, address _strategy) external initializer {
      _setupRole(MINTER_ROLE, _strategy);
      wrappedToken = _wrappedToken;
  }

  function mint(address _to, uint256 _amount) public override {
      IERC20(wrappedToken).safeTransferFrom(_to, address(this), _amount);
      super.mint(_to, _amount);
  }

  function burnFrom(address _account, uint256 _amount) public override onlyMinter {
    super.burnFrom(_account, _amount);
    IERC20(wrappedToken).safeTransfer(_account, _amount);
  }

  function burn(uint256 _amount) public override onlyMinter {
      super.burn(_amount);
      IERC20(wrappedToken).safeTransfer(_msgSender(), _amount);
  }

  function transfer(address _recipient, uint256 _amount)
      public
      override
      onlyMinter
      returns(bool)
  {
      super.transfer(_recipient, _amount);
      IERC20(wrappedToken).safeTransfer(_recipient, _amount);
  }

  function allowance(address _owner, address _spender)
      public
      view
      override
      onlyMinter
      returns(uint256)
  {
      uint256 localAllowance = super.allowance(_owner, _spender);
      require(localAllowance == IERC20(wrappedToken).allowance(_owner, _spender), "!equal");
      return localAllowance;
  }

  function approve(address _spender, uint256 _amount)
      public
      override
      onlyMinter
      returns(bool)
  {
      super.approve(_spender, _amount);
      IERC20(wrappedToken).approve(_spender, _amount);
  }

  function transferFrom(address _sender, address _recipient, uint256 _amount)
      public
      override
      onlyMinter
      returns(bool)
  {
      super.transferFrom(_sender, recipient, _amount);
      IERC20(wrappedToken).safeTransferFrom(_sender, recipient, _amount);
  }

  function increaseAllowance(address _spender, uint256 _addedValue)
      public
      override
      onlyMinter
      returns(bool)
  {
    super.increaseAllowance(_sender, _addedValue);
    ERC20(wrappedToken).increaseAllowance(_spender, _addedValue);
  }

  function decreaseAllowance(address _spender, uint256 _subtractedValue)
      public
      override
      onlyMinter
      returns(bool)
  {
    super.decreaseAllowance(_sender, _subtractedValue);
    ERC20(wrappedToken).decreaseAllowance(_spender, _subtractedValue);
  }

}
