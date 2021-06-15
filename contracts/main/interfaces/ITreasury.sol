pragma solidity ^0.6.0;

/*
@dev The Treasury contract accumulates all the Management fees sent from the strategies.
It's an intermediate contract that can convert between different tokens,
currently normalizing all rewards into provided default token.
*/
interface ITreasury {
    function toVoters() external;
    function toGovernance(address _token, uint256 _amount) external;
    function convert(address _from, uint256 _parts) external;
}
