pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "../../staking_rewards/StakingRewards.sol";

import "../../interfaces/vault/IVaultCore.sol";
import "../../interfaces/vault/IVaultTransfers.sol";
import "../../interfaces/vault/IVaultDelegated.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/IStrategy.sol";

/// @title EURxbVault
/// @notice Base vault contract, used to manage funds of the clients
contract BaseVaultNew is IVaultCore, IVaultTransfers, Ownable, , RewardsDistributionRecipient, ReentrancyGuard, Pausable, Initializable {

    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /// @notice Controller instance, to simplify controller-related actions
    IController internal _controller;

    address public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public rewardsDuration; //= 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    struct RewardInfo {
        address what;
        uint256 amount;
    }

    struct ClaimParams {
        address what;
        /*
        000000AB - bitwise representation of claimMap parameter.
        A bit - if 1 - autoclaim else do not attempt to claim
        B bit - if 1 - claim from business logic in strategy else do not claim

        Invalid values:
          1 = 00000001 - you cannot withdraw without claim and claim from business logic
        Valid values:
          0 = 00000000 - just withdraw
          2 = 00000010 - withdraw with claim without claim from business logic
          3 = 00000011 - withdraw with claim and with claim from business logic
        */
        uint8 claimMap;
    }

    // reward token => reward rate
    mapping(address => uint256) public rewardRates;

    mapping(address => RewardInfo) public userRewardPerTokenPaid;
    mapping(address => RewardInfo) public rewards;

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;

    EnumerableSet.AddressSet public validTokens;

    /* ========== EVENTS ========== */

    event RewardAdded(address what, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address what, address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _initialToken Business token logic address
    /// @param _initialController Controller instance address
    function _configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address[] memory _rewardsTokens
    ) internal {
        setController(_initialController);
        transferOwnership(_governance);
    }

    /// @notice Usual setter with check if passet param is new
    /// @param _newController New value
    function setController(address _newController) public onlyOwner {
        require(address(_controller) != _newController, "!new");
        _controller = IController(_newController);
    }

    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external override view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public override view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken(address _rewardToken)
        public
        override
        view
        onlyValidToken(_rewardToken)
        returns(uint256)
    {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRates[_rewardToken]).mul(1e18).div(_totalSupply)
            );
    }

    function earned(address _rewardToken, address account)
        public
        override
        virtual
        onlyValidToken(_rewardToken)
        view
        returns(uint256)
    {
        return _balances[account]
          .mul(
            rewardPerToken(_rewardToken).sub(userRewardPerTokenPaid[account])
          )
          .div(1e18).add(rewards[account]);
    }

    function getRewardForDuration(address _rewardToken)
        external
        override
        view
        onlyValidToken(_rewardToken)
        returns(uint256) {
        return rewardRates[_rewardToken].mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount)
        external
        virtual
        override
        nonReentrant
        whenNotPaused
        updateReward(msg.sender)
    {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function _withdraw(uint256 _amount) internal {
        require(_amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(_amount);
        _balances[msg.sender] = _balances[msg.sender].sub(_amount);
        IERC20(stakingToken).safeTransfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    function withdraw(
        uint256 _amount,
        ClaimParams memory _claimParams
    )
        public
        virtual
        nonReentrant
        updateReward(_claimParams.what, msg.sender)
    {
        require(_claimParams.claimMap != 1, "invalidMap");
        if (_claimParams.claimMap >> 1 == 1) {
            getReward(_claimParams.what, _claimParams.claimMap);
        }
        _withdraw(_amount);
    }

    function withdraw(uint256 _amount)
        public
        virtual
        override
        nonReentrant
    {
        for (uint256 i = 0; i < validTokens.length(); i++) {
            _updateReward(validTokens.at(i), _amount);
        }
        _withdraw(_amount);
    }

    function getReward(address _rewardToken, uint8 _claimMap)
        public
        virtual
        override
        nonReentrant
        onlyValidToken(_rewardToken)
        updateReward(_rewardToken, msg.sender)
    {
        uint256 reward = rewards[msg.sender].amount;
        if (_claimMap << 7 == 1) {
          // выполнить клейм в выводом наград из бизнес логики стратегии
        } else {
          _controller.claim(...);
        }
        if (reward > 0) {
            rewards[msg.sender] = 0;
            IERC20(rewardsToken).safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external virtual override {
        withdraw(_balances[msg.sender]);
        for (uint256 i = 0; i < validTokens.length(); i++) {
            getReward(validTokens.at(i));
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(address _rewardToken, uint256 _reward)
        external
        virtual
        override
        onlyRewardsDistribution
        onlyValidToken(_rewardToken)
        updateReward(_rewardToken, address(0))
    {
        if (block.timestamp >= periodFinish) {
            rewardRates[_rewardToken] = _reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRates[_rewardToken]);
            rewardRates[_rewardToken] = _reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = IERC20(_rewardToken).balanceOf(address(this));
        require(rewardRates[_rewardToken] <= balance.div(rewardsDuration), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(_rewardToken, reward);
    }

    // End rewards emission earlier
    function updatePeriodFinish(uint256 timestamp)
        external
        onlyOwner
        updateReward(address(0))
    {
        periodFinish = timestamp;
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != stakingToken, "Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    function addRewardToken(address _rewardToken) external onlyOwner {
        require(validTokens.add(_rewardToken), "!add");
    }

    function removeRewardToken(address _rewardToken) external onlyOwner {
        require(validTokens.remove(_rewardToken), "!remove");
    }

    function isTokenValid(address _rewardToken) external view returns(bool) {
        return validTokens.contains(_rewardToken);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyValidToken(address _rewardToken) {
        require(validTokens.contains(_rewardToken), "!valid");
        _;
    }

    function _updateReward(address _what, address _account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account].amount = earned(account);
            userRewardPerTokenPaid[account].amount = rewardPerTokenStored;
        }
    }

    modifier updateReward(address _what, address _account) {
        _updateReward(_what, _account);
        _;
    }

    /// @notice Transfer tokens to controller, controller transfers it to strategy and earn (farm)
    function earn() override external {
        uint256 _bal = available();
        _token.safeTransfer(address(_controller), _bal);
        _controller.earn(address(_token), _bal);
    }
}
