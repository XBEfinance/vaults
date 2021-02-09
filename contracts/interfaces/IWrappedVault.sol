pragma solidity ^0.6.0;


interface IWrappedVault {
    function token() external view returns(address);

    function governance() external view returns(address);

    function vault() external view returns(address);

    function getPricePerFullShare() external view returns(uint256);
}
