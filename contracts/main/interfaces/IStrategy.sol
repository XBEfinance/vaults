pragma solidity ^0.6.0;


interface IStrategy {
    function want() external view returns(address);

    function deposit() external;

    // NOTE: must exclude any tokens used in the yield
    // Controller role - withdraw should return to Controller
    function withdraw(address) external;

    // Controller | Vault role - withdraw should always return to Vault
    function withdraw(uint256) external;

    function skim() external;

    // Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() external returns(uint256);

    function balanceOf() external view returns(uint256);

    function withdrawalFee() external view returns(uint256);

    function setVault(address _newVault) external;

    function setController(address _newController) external;

    function setWant(address _newWant) external;

    function getRewards() external;

    function earned() external returns(uint256, uint256, uint256);

    function canClaimCrv() external returns(uint256);

    function claim(uint256 _crv, uint256 _cvx, uint256 _xbe) external returns(bool);

}
