pragma solidity ^0.6.0;

/*
The Treasury contract accumulates all the Management fees sent from the strategies.
It's an intermediate contract that can convert between different tokens,
currently normalizing all rewards into provided default token.
*/
interface ITreasury {
    function toVoters(address _token, uint256 _amount) external;
    function toGovernance(address _token, uint256 _amount) external;
    function setDefaultToken(address _token) external;
    function convertToDefaultToken() external;
}
