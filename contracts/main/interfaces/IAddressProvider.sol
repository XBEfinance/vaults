pragma solidity ^0.6.0;

interface IAddressProvider {
    function admin() external view returns (address);

    function get_registry() external view returns (address);

    function get_address(uint256 _id) external view returns (address);
}
