pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";


abstract contract IRewardDistributionRecipient is Ownable {

    address public rewardDistribution;

    function notifyRewardAmount(uint256 reward) external virtual;

    modifier onlyRewardDistribution {
        require(msg.sender == rewardDistribution, "Caller is not reward distribution.");
        _;
    }

    function setRewardDistribution(address _rewardDistribution)
        public
        onlyOwner
    {
        rewardDistribution = _rewardDistribution;
    }
}
