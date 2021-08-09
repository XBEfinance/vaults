pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../../interfaces/vault/IVaultCore.sol";
import "../../interfaces/vault/IVaultTransfers.sol";
import "../../interfaces/vault/IVaultDelegated.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/IStrategy.sol";

import "../../mocks/StringsConcatenations.sol";

import "./VaultWithFeesOnClaim.sol";

/// @title EURxbVault
/// @notice Base vault contract, used to manage funds of the clients
abstract contract BaseVault is IVaultCore, IVaultTransfers, IERC20, Ownable, ReentrancyGuard, Pausable, Initializable {

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

    // valid token => user => amount
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

    function balanceOf(address _account) public override view returns(uint256) {
        return _balances[_account];
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

    function earned(address _rewardToken, address _account)
        public
        virtual
        onlyValidToken(_rewardToken)
        view
        returns(uint256)
    {
        return _balances[_account]
          .mul(
            rewardPerToken(_rewardToken).sub(userRewardPerTokenPaid[_rewardToken][_account])
          )
          .div(1e18)
        .add(rewards[_account][_rewardToken]);
    }

    function getRewardForDuration(address _rewardToken)
        external
        view
        onlyValidToken(_rewardToken)
        returns(uint256) {
        return rewardRates[_rewardToken].mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function _withdrawFrom(address _from, uint256 _amount) internal virtual returns(uint256) {
        require(_amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(_amount);
        _balances[_from] = _balances[_from].sub(_amount);
        address strategyAddress = IController(_controller).strategies(address(stakingToken));
        uint256 amountOnVault = stakingToken.balanceOf(address(this));
        if (amountOnVault < _amount) {
            IStrategy(strategyAddress).withdraw(_amount.sub(amountOnVault));
        }
        stakingToken.safeTransfer(_from, _amount);
        emit Withdrawn(_from, _amount);
        return _amount;
    }

    function _withdraw(uint256 _amount) internal returns(uint256) {
        return _withdrawFrom(msg.sender, _amount);
    }

    function _deposit(address _from, uint256 _amount) internal virtual returns(uint256) {
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
        __getReward(_claimMask);
        _withdraw(_amount);
    }

    function withdrawAll() public virtual override {
        withdraw(_balances[msg.sender], 0x03);
    }

    function _getReward(
        uint8 _claimMask,
        address _for,
        address _rewardToken,
        address _stakingToken
    )
        internal virtual
    {
        if (_claimMask == 2) {
            _controller.claim(_stakingToken, _rewardToken);
        } else if (_claimMask == 3) {
            _controller.getRewardStrategy(_stakingToken);
            _controller.claim(_stakingToken, _rewardToken);
        }
        uint256 reward = rewards[_for][_rewardToken];
        if (reward > 0) {
            rewards[_for][_rewardToken] = 0;
            IERC20(_rewardToken).safeTransfer(_for, reward);
        }
        emit RewardPaid(_rewardToken, _for, reward);
    }

    function __getReward(uint8 _claimMask) virtual internal {
        address _stakingToken = address(stakingToken);
        __updateReward(msg.sender);
        for (uint256 i = 0; i < _validTokens.length(); i++) {
            _getReward(
                _claimMask,
                msg.sender,
                _validTokens.at(i),
                _stakingToken
            );
        }
    }

    function getReward(uint8 _claimMask)
        public
        virtual
        nonReentrant
        validClaimMask(_claimMask)
        updateReward(msg.sender)
    {
        __getReward(_claimMask);
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

    function userReward(address _account, address _token)
        external view
        onlyValidToken(_token)
        returns(uint256)
    {
        return rewards[_account][_token];
    }

    function _updateReward(address _what, address _account) internal {
        rewardsPerTokensStored[_what] = rewardPerToken(_what);
        lastUpdateTime = lastTimeRewardApplicable();
        if (_account != address(0)) {
            rewards[_account][_what] = earned(_what, _account);
            userRewardPerTokenPaid[_what][_account] = rewardsPerTokensStored[_what];
        }
    }

    function __updateReward(address _account) internal {
        for (uint256 i = 0; i < _validTokens.length(); i++) {
            _updateReward(_validTokens.at(i), _account);
        }
    }

    modifier updateReward(address _account) {
        __updateReward(_account);
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
    function earn() external virtual override {
        uint256 _bal = stakingToken.balanceOf(address(this));
        stakingToken.safeTransfer(address(_controller), _bal);
        _controller.earn(address(stakingToken), _bal);
        for (uint256 i = 0; i < _validTokens.length(); i++) {
            _controller.claim(address(stakingToken), _validTokens.at(i));
        }
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

    function potentialRewardReturns(address _rewardsToken, uint256 _duration, address _account)
        external
        view
        returns(uint256)
    {
        uint256 _rewardsAmount = _balances[_account]
            .mul(
                _rewardPerTokenForDuration(_rewardsToken, _duration)
                    .sub(userRewardPerTokenPaid[_rewardsToken][msg.sender]))
            .div(1e18)
            .add(rewards[_account][_rewardsToken]);
        return _rewardsAmount;
    }
}
