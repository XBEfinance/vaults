pragma solidity >=0.6.0 <0.7.0;

interface IDDP {
    /**
     * @dev configures DDP to use BondToken, EURxb contract and AllowList addresses
     * @param bond BondToken contract address
     * @param eurxb EURxb contract address
     * @param allowList AllowList address
     */
    function configure(address bond, address eurxb, address allowList) external;

    function setClaimPeriod(uint256 claimPeriod) external;

    function deposit(
        uint256 tokenId,
        uint256 value,
        uint256 maturity,
        address to
    ) external;

    /**
     *  repays bond token, any user can call it
     */
    function withdraw(uint256 tokenId) external;


    function getClaimPeriod() external view returns (uint256);
}
