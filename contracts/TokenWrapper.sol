pragma solidity ^0.6.0;

import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


/// @title TokenWrapper
/// @notice local wrapper for mediocre purposes only
contract TokenWrapper is ERC20PresetMinterPauser {

  using SafeERC20 for IERC20;

  address public wrappedToken;

  modifier onlyMinter {
    require(hasRole(MINTER_ROLE, msg.sender), "!minter");
    _;
  }

  constructor(
    string memory tokenName,
    string memory tokenSymbol,
    address _wrappedToken,
    address _entity
  )
    public
    ERC20PresetMinterPauser(
      string(abi.encodePacked(tokenName, ' Wrapped')),
      string(abi.encodePacked('w', tokenSymbol))
    )
  {
    _setupRole(MINTER_ROLE, _entity);
    wrappedToken = _wrappedToken;
  }

  function mint(uint256 _amount) public onlyMinter {
      IERC20(wrappedToken).safeTransferFrom(msg.sender, address(this), _amount);
      _mint(msg.sender, _amount);
  }

  function burn(uint256 _amount) public override onlyMinter {
      _burn(msg.sender, _amount);
      IERC20(wrappedToken).safeTransfer(msg.sender, _amount);
  }
}
