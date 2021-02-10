pragma solidity ^0.6.0;

interface IVaultDelegated {
  function claimInsurance() external;
  function underlying() external view returns(address);
}
