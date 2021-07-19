pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../../interfaces/vault/IVaultCore.sol";
import "../../interfaces/vault/IVaultTransfers.sol";
import "../../interfaces/vault/IVaultDelegated.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/IStrategy.sol";

/// @title EURxbVault
/// @notice Base vault contract, used to manage funds of the clients
contract BaseVault is IVaultCore, IVaultTransfers, IERC20, Ownable, ReentrancyGuard, Pausable, Initializable {

    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /// @notice Controller instance, to simplify controller-related actions
    IController internal _controller;

    IERC20 public stakingToken;
    uint256 public periodFinish;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;

    address public rewardsDistribution;

    /// @dev _tokenThatComesPassively is XBE or any token that transfers passively
    /// to the strategy without third party contracts or explicit request from
    /// either vault, or strategy, or user. This parameter used in earnedVirtual() function below.
    address internal _tokenThatComesPassively;

    // token => reward per token stored
    mapping(address => uint256) public rewardsPerTokensStored;

    // reward token => reward rate
    mapping(address => uint256) public rewardRates;

    // user => valid token => amount
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;

    // user => valid token => amount
    mapping(address => mapping(address => uint256)) public rewards;

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;
    mapping(address => mapping(address => uint256)) internal _allowances;

    EnumerableSet.AddressSet internal _validTokens;

    string private _name;
    string private _symbol;
    string private _namePostfix;
    string private _symbolPostfix;

    /* ========== EVENTS ========== */

    event RewardAdded(address what, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address what, address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory __name, string memory __symbol) public {
        _name = __name;
        _symbol = __symbol;
    }

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _initialToken Business token logic address
    /// @param _initialController Controller instance address
    function _configure(
        address _initialToken,
        address _initialController,
        address _governance,
        uint256 _rewardsDuration,
        address[] memory _rewardsTokens,
        string memory __namePostfix,
        string memory __symbolPostfix
    ) internal {
        setController(_initialController);
        transferOwnership(_governance);
        stakingToken = IERC20(_initialToken);
        rewardsDuration = _rewardsDuration;
        _namePostfix = __namePostfix;
        _symbolPostfix = __symbolPostfix;
        for (uint256 i = 0; i < _rewardsTokens.length; i++) {
            _validTokens.add(_rewardsTokens[i]);
        }
    }

    /// @notice Usual setter with check if passet param is new
    /// @param _newController New value
    function setController(address _newController) public onlyOwner {
        require(address(_controller) != _newController, "!new");
        _controller = IController(_newController);
    }

    function setRewardsDistribution(address _rewardsDistribution) external onlyOwner {
        rewardsDistribution = _rewardsDistribution;
    }

    function name() public view virtual returns (string memory) {
        return string(abi.encodePacked(_name, _namePostfix));
    }

    function symbol() public view virtual returns (string memory) {
        return string(abi.encodePacked(_symbol, _symbolPostfix));
    }

    function decimals() public view virtual returns (uint8) {
       return 18;
    }

    function totalSupply() public override view returns(uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public override view returns(uint256) {
        return _balances[account];
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "BaseVault: transfer from the zero address");
        require(recipient != address(0), "BaseVault: transfer to the zero address");

        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "BaseVault: transfer amount exceeds balance");
        _balances[sender] = senderBalance - amount;
        _balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);

    }

    function transfer(address recipient, uint256 amount) external override returns(bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external override view returns (uint256) {
        return _allowances[owner][spender];
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "BaseVault: approve from the zero address");
        require(spender != address(0), "BaseVault: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "BaseVault: decreased allowance below zero");
        _approve(msg.sender, spender, currentAllowance - subtractedValue);

        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "BaseVault: transfer amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);

        return true;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken(address _rewardToken)
        public
        view
        onlyValidToken(_rewardToken)
        returns(uint256)
    {
        if (_totalSupply == 0) {
            return rewardsPerTokensStored[_rewardToken];
        }
        return
            rewardsPerTokensStored[_rewardToken].add(
                lastTimeRewardApplicable().sub(lastUpdateTime)
                    .mul(rewardRates[_rewardToken])
                    .mul(1e18)
                    .div(_totalSupply)
            );
    }

    function earned(address _rewardToken, address account)
        public
        virtual
        onlyValidToken(_rewardToken)
        view
        returns(uint256)
    {
        return _balances[account]
          .mul(
            rewardPerToken(_rewardToken).sub(userRewardPerTokenPaid[account][_rewardToken])
          )
          .div(1e18).add(rewards[account][_rewardToken]);
    }

    function getRewardForDuration(address _rewardToken)
        external
        view
        onlyValidToken(_rewardToken)
        returns(uint256) {
        return rewardRates[_rewardToken].mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function _withdrawFrom(address _from, uint256 _amount) internal returns(uint256) {
        require(_amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(_amount);
        _balances[_from] = _balances[_from].sub(_amount);
        stakingToken.safeTransfer(_from, _amount);
        emit Withdrawn(_from, _amount);
        return _amount;
    }

    function _withdraw(uint256 _amount) internal returns(uint256) {
        return _withdrawFrom(msg.sender, _amount);
    }

    function _deposit(address _from, uint256 _amount) internal returns(uint256) {
        require(_amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(_amount);
        _balances[_from] = _balances[_from].add(_amount);
        stakingToken.safeTransferFrom(_from, address(this), _amount);
        emit Staked(_from, _amount);
        return _amount;
    }

    function deposit(uint256 amount)
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        updateReward(msg.sender)
    {
        _deposit(msg.sender, amount);
    }

    function depositFor(uint256 _amount, address _for)
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        updateReward(_for)
    {
        _deposit(_for, _amount);
    }

    function depositAll()
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        updateReward(msg.sender)
    {
        uint256 _balance = stakingToken.balanceOf(msg.sender);
        require(_balance > 0, "0balance");
        _deposit(msg.sender, _balance);
    }

    function withdraw(uint256 _amount)
        public
        virtual
        override
    {
        withdraw(_amount, 0x03);
    }


    /// @dev What is claimMask parameter?
    /// 0b000000AB - bitwise representation of claimMask parameter.
    /// A bit - if 1 autoclaim else do not attempt to claim
    /// B bit - if 1 claim from business logic in strategy else do not claim
    ///
    /// Invalid values:
    ///  0x01 = 0b00000001 - you cannot (withdraw without claim) and (claim from business logic)
    ///  0x00 = 0b00000000 - you cannot just withdraw because
    ///                         you'd have to redeposit your previous share to claim it
    /// Valid values:
    ///  0x02 = 0b00000010 - withdraw with claim without claim from business logic
    ///  0x03 = 0b00000011 - withdraw with claim and with claim from business logic
    function withdraw(
        uint256 _amount,
        uint8 _claimMask
    )
        public
        virtual
        nonReentrant
        validClaimMask(_claimMask)
    {
        getReward(_claimMask);
        _withdraw(_amount);
    }

    function withdrawAll() public virtual override {
        withdraw(_balances[msg.sender], 0x03);
    }

    function _claimThroughControllerAndReturnClaimed(
        address _stakingToken,
        address _for,
        address _what,
        uint256 _reward
    ) internal returns(uint256 _claimed) {
        uint256 _before = IERC20(_what).balanceOf(address(this));
        address[] memory _tokensToClaim = new address[](1);
        _tokensToClaim[0] = _what;
        uint256[] memory _amountsToClaim = new uint256[](1);
        _amountsToClaim[0] = _reward;
        _controller.claim(
            _stakingToken,
            _for,
            _tokensToClaim,
            _amountsToClaim
        );
        uint256 _after = IERC20(_what).balanceOf(address(this));
        (,_claimed) = _after.trySub(_before);
    }

    function _getReward(
        uint8 _claimMask,
        address _for,
        address _what,
        address _stakingToken
    )
        internal
    {
        uint256 reward = rewards[_for][_what];
        if (reward > 0) {
            if (_claimMask >> 1 == 1 && _claimMask << 7 != 128) {
                reward = _claimThroughControllerAndReturnClaimed(
                    _stakingToken,
                    _for,
                    _what,
                    reward
                );
            } else if (_claimMask >> 1 == 1 && _claimMask << 7 == 128) {
                IStrategy(_controller.strategies(_stakingToken)).getRewards();
                reward = _claimThroughControllerAndReturnClaimed(
                    _stakingToken,
                    _for,
                    _what,
                    reward
                );
            }
            if (reward > 0) {
                rewards[_for][_what] = 0;
                IERC20(_what).safeTransfer(_for, reward);
                emit RewardPaid(_what, _for, reward);
            } else {
                emit RewardPaid(_what, _for, 0);
            }
        }
    }

    function getReward(uint8 _claimMask)
        public
        virtual
        nonReentrant
        validClaimMask(_claimMask)
        updateReward(msg.sender)
    {
        address _stakingToken = address(stakingToken);
        for (uint256 i = 0; i < _validTokens.length(); i++) {
            _getReward(
                _claimMask,
                msg.sender,
                _validTokens.at(i),
                _stakingToken
            );
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(address _rewardToken, uint256 _reward)
        external
        virtual
        onlyRewardsDistribution
        onlyValidToken(_rewardToken)
        updateReward(address(0))
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
        require(rewardRates[_rewardToken] <= balance.div(rewardsDuration),
            "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(_rewardToken, _reward);
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
        require(tokenAddress != address(stakingToken), "Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish, "!periodFinish"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    function addRewardToken(address _rewardToken) external onlyOwner {
        require(_validTokens.add(_rewardToken), "!add");
    }

    function removeRewardToken(address _rewardToken) external onlyOwner {
        require(_validTokens.remove(_rewardToken), "!remove");
    }

    function isTokenValid(address _rewardToken) external view returns(bool) {
        return _validTokens.contains(_rewardToken);
    }

    function getRewardToken(uint256 _index) external view returns(address) {
        return _validTokens.at(_index);
    }

    function getRewardTokensCount() external view returns(uint256) {
        return _validTokens.length();
    }

    /* ========== MODIFIERS ========== */

    modifier onlyValidToken(address _rewardToken) {
        require(_validTokens.contains(_rewardToken), "!valid");
        _;
    }

    function _updateReward(address _what, address _account) internal {
        rewardsPerTokensStored[_what] = rewardPerToken(_what);
        if (_account != address(0)) {
            rewards[_what][_account] = earned(_what, _account);
            userRewardPerTokenPaid[_what][_account] = rewardsPerTokensStored[_what];
        }
    }

    modifier updateReward(address _account) {
        lastUpdateTime = lastTimeRewardApplicable();
        for (uint256 i = 0; i < _validTokens.length(); i++) {
            _updateReward(_validTokens.at(i), _account);
        }
        _;
    }

    modifier validClaimMask(uint8 _mask) {
        require(_mask != 1 && _mask < 4 && _mask > 0, "invalidClaimMask");
        _;
    }

    modifier onlyRewardsDistribution() {
        require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
        _;
    }

    /// @notice Transfer tokens to controller, controller transfers it to strategy and earn (farm)
    function earn() external override {
        uint256 _bal = balance();
        stakingToken.safeTransfer(address(_controller), _bal);
        _controller.earn(address(stakingToken), _bal);
    }

    function token() external override view returns(address) {
        return address(stakingToken);
    }

    function controller() external override view returns(address) {
        return address(_controller);
    }

    /// @notice Exist to calculate price per full share
    /// @return Price of the staking token per share
    function getPricePerFullShare() override external view returns(uint256) {
        return balance().mul(1e18).div(totalSupply());
    }

    function balance() public override view returns(uint256) {
        IStrategy strategy = IStrategy(_controller.strategies(address(stakingToken)));
        return
            stakingToken.balanceOf(address(this))
                .add(strategy.balanceOf());
    }

    function earnedReal() public view returns(uint256[] memory amounts) {
        address[] memory _tokenRewards = new address[](_validTokens.length());
        for (uint256 i = 0; i < _tokenRewards.length; i++) {
            _tokenRewards[i] = _validTokens.at(i);
        }
        IStrategy _strategy = IStrategy(_controller.strategies(address(stakingToken)));
        amounts = _strategy.earned(_tokenRewards);
        uint256 _share = balanceOf(msg.sender);
        for(uint256 i = 0; i < _tokenRewards.length; i++){
            amounts[i] = amounts[i]
                .add(
                    IERC20(_tokenRewards[i]).balanceOf(address(this))
                )
                .mul(_share)
                .div(totalSupply());
        }
        amounts = IStrategy(_controller.strategies(address(stakingToken))).subFee(amounts);
    }

    function earnedVirtual() external view returns(uint256[] memory virtualAmounts) {
        uint256[] memory realAmounts = earnedReal();
        uint256[] memory virtualEarned = new uint256[](realAmounts.length);
        virtualAmounts = new uint256[](realAmounts.length);
        IStrategy _strategy = IStrategy(_controller.strategies(address(stakingToken)));
        for (uint256 i = 0; i < virtualAmounts.length; i++) {
            virtualEarned[i] = _strategy.canClaimAmount(_validTokens.at(i));
        }
        virtualEarned = _strategy.subFee(virtualEarned);
        uint256 _share = balanceOf(msg.sender);
        for(uint256 i = 0; i < realAmounts.length; i++){
            if(_validTokens.at(i) == _tokenThatComesPassively) {
                virtualAmounts[i] = realAmounts[i].mul(_share).div(totalSupply());
            } else {
                virtualAmounts[i] = realAmounts[i].add(virtualEarned[i]).mul(_share).div(totalSupply());
            }
        }
    }

    function getPoolRewardForDuration(address _rewardToken, uint256 _duration)
        public view returns(uint256)
    {
        uint256 poolTokenBalance = stakingToken.balanceOf(address(this));
        if (poolTokenBalance == 0) {
            return rewardsPerTokensStored[_rewardToken];
        }
        return rewardsPerTokensStored[_rewardToken].add(
            _duration
                .mul(rewardRates[_rewardToken])
                .mul(1e18)
                .div(poolTokenBalance)
        );
    }

    function _rewardPerTokenForDuration(address _rewardsToken, uint256 _duration)
        internal
        view
        returns(uint256)
    {
        if (_totalSupply == 0) {
            return rewardsPerTokensStored[_rewardsToken];
        }
        return
            rewardsPerTokensStored[_rewardsToken].add(
                _duration.mul(rewardRates[_rewardsToken]).mul(1e18).div(_totalSupply)
            );
    }

    function potentialRewardReturns(address _rewardsToken, uint256 _duration)
        public
        view
        returns(uint256)
    {
        uint256 _rewardsAmount = _balances[msg.sender]
            .mul(
                _rewardPerTokenForDuration(_rewardsToken, _duration)
                    .sub(userRewardPerTokenPaid[_rewardsToken][msg.sender]))
            .div(1e18)
            .add(rewards[_rewardsToken][msg.sender]);
        return _rewardsAmount;
    }
}