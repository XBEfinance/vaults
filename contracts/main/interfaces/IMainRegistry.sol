pragma solidity ^0.6.0;

interface IMainRegistry {
    function get_coins(address _pool) external returns (address[] memory);

    function pool_count() external view returns (uint256);

    function pool_list() external view returns (address[] memory);
}
