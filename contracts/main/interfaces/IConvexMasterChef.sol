pragma solidity >=0.6.0 <0.7.0;

interface IConvexMasterChef {
    struct PoolInfo {
        address lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. CVX to distribute per block.
        uint256 lastRewardBlock; // Last block number that CVXs distribution occurs.
        uint256 accCvxPerShare; // Accumulated CVXs per share, times 1e12. See below.
        address rewarder;
    }
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function claim(uint256 _pid, address _account) external;
    function poolInfo(uint256 _index) external returns(PoolInfo memory);
    function pendingCvx(uint256 _pid, address _user) external;
    function poolLength() external view returns(uint256);
}
