pragma solidity ^0.6.0;

interface IVaultCore {
  function token() external view returns(address);
  function controller() external view returns(address);
  function getPricePerFullShare() external view returns(uint256);
  function balance() external view returns(uint256);
}
