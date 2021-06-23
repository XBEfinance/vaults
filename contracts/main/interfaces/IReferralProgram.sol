pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;



interface IReferralProgram {
    struct User {
        bool exists;
        address referrer;
    }

    function users(address wallet) external returns (User memory);
    function registerUser(address referrer, address referral) external;
    function notifyReward(address spender, uint256 crvValue, uint256 cvxValue, uint256 xbeValue) external;
}
