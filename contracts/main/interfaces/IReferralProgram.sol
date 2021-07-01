pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;



interface IReferralProgram {
    struct User {
        bool exists;
        address referrer;
    }
    function users(address wallet) external returns (bool exists, address referrer);
    function registerUser(address referrer, address referral) external;
    function feeReceiving(address _for, address[] calldata _tokens, uint256[] calldata _amounts) external;
}
