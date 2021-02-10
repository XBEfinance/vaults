pragma solidity ^0.6.0;

interface IVaultBusiness {
  function harvest(address _reserve, uint256 _amount) external;
  function earn() external;
}
