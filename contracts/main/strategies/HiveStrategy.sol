pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./base/ClaimableStrategy.sol";
import '../interfaces/IMainRegistry.sol';
import '../interfaces/IBooster.sol';
import '../interfaces/IRewards.sol';

/// @title HiveStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
contract HiveStrategy is ClaimableStrategy {

    using SafeERC20 for IERC20;

    using EnumerableSet for EnumerableSet.AddressSet;

    IMainRegistry public mainRegistry;

    // reward token => IRewards of convex
    mapping (address => address) public rewardTokensToConvexRewards;

    struct Settings  {
        address poolCurve;
        address lpCurve;
        address crvRewards;
        address lpConvex;
        address convexBooster;
        uint8 nCoins; //coins in pool
        // uint8 idPool;
        uint256 poolIndex;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress, //in this case it's lP curve
        address _controllerAddress,
        address _vaultAddress,
        address _governance,
        address _tokenToAutostake,
        address _voting,
        address _crv,
        address _cvx,
        Settings memory _poolSettings
    ) public initializer {
        _configure(
            _wantAddress,
            _controllerAddress,
            _vaultAddress,
            _governance,
            _tokenToAutostake,
            _voting
        );
        poolSettings = _poolSettings;
        rewardTokensToConvexRewards[_crv] = _poolSettings.crvRewards;
        rewardTokensToConvexRewards[_cvx] = _poolSettings.crvRewards;
    }

    function setMainRegistry(address _mainRegistry) external onlyOwner {
        mainRegistry = IMainRegistry(_mainRegistry);
    }

    function setPoolIndex(uint256 _newPoolIndex) external onlyOwner {
        poolSettings.poolIndex = _newPoolIndex;
    }

    function checkIfPoolIndexNeedsToBeUpdated() public view returns(bool) {
        IBooster.PoolInfo memory _pool = IBooster(poolSettings.convexBooster)
            .poolInfo(poolSettings.poolIndex);
        return _pool.lptoken == poolSettings.lpCurve;
    }

     /// @dev Function that controller calls
    function deposit() override external onlyController {
        uint256 _amount = IERC20(_want).balanceOf(address(this));
        _totalDeposited += _amount;

        uint256 _poolLength = IBooster(poolSettings.convexBooster).poolLength();

        require(checkIfPoolIndexNeedsToBeUpdated(), "poolIndexDeprecated");

        IERC20(_want).approve(poolSettings.convexBooster, _amount);
        //true means that the received lp tokens will immediately be stakes
        IBooster(poolSettings.convexBooster)
            .depositAll(poolSettings.poolIndex, true);
    }

    function getRewards() override external {
        require(IRewards(poolSettings.crvRewards).getReward(), '!getRewards');
    }

    /// @dev Used to be:
    /// _amount = IRewards(poolSettings.crvRewards).earned(address(this));
    function canClaimAmount(address _rewardToken) override external returns(uint256 _amount) {
        _amount = IRewards(rewardTokensToConvexRewards[_rewardToken])
            .earned(address(this));
    }

    function _withdrawSome(uint256 _amount) override internal returns(uint) {
        require(IRewards(poolSettings.crvRewards).withdrawAndUnwrap(_amount, true), '!withdrawSome');
        return _amount;
    }

    function convertTokens(address _for, uint256 _amount) override external {}
}
