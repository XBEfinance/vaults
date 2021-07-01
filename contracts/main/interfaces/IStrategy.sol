pragma solidity ^0.6.0;


interface IStrategy {
    function want() external view returns(address);

    function deposit() external;

    /// NOTE: must exclude any tokens used in the yield
    /// Controller role - withdraw should return to Controller
    function withdraw(address) external;

    /// Controller | Vault role - withdraw should always return to Vault
    function withdraw(uint256) external;

    function skim() external;

    ///Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() external returns(uint256);

    function balanceOf() external view returns(uint256);

    function withdrawalFee() external view returns(uint256);

    function setVault(address) external;

    function setController(address) external;

    function setWant(address) external;

    function getRewards() external;

    function earned(address[] memory) external returns(uint256[] memory);

    function canClaim() external returns(uint256);

    function claim(address, address[] memory, uint256[] memory) external returns(bool);

    function subFee(uint256[] memory) external view returns(uint256[] memory);

    function convertTokens(address, uint256) external;
}