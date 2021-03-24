pragma solidity ^0.6.0;

import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

  function burn(uint256 _amount) public override onlyMinter {
      super.burn(_amount);
      IERC20(wrappedToken).safeTransfer(_msgSender(), _amount);
  }
}
