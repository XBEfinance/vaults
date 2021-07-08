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

    struct Settings  {
        address poolCurve;
        address lpCurve;
        address crvRewards;
        address lpConvex;
        address convexBooster;
        uint8 nCoins; //coins in pool
        // uint8 idPool;
    }

    Settings public poolSettings;

    function configure(
        address _wantAddress, //in this case it's lP curve
        address _controllerAddress,
        address _vaultAddress,
        address _governance,
        address _tokenToAutostake,
        address _voting,
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
    }

    function setMainRegistry(address _mainRegistry) external onlyOwner {
        mainRegistry = IMainRegistry(_mainRegistry);
    }

     /// @dev Function that controller calls
    function deposit() override external onlyController {
        uint256 _amount = IERC20(_want).balanceOf(address(this));
        IERC20(_want).approve(poolSettings.convexBooster, _amount);

        uint256 _poolLength = IBooster(poolSettings.convexBooster).poolLength();
        //if we don't know if of pool in Booster
        for(uint256 i = 0; i < _poolLength; i++){
            IBooster.PoolInfo memory _pool = IBooster(poolSettings.convexBooster).poolInfo(i);
            if(_pool.lptoken == poolSettings.lpCurve){
                 //true means that the received lp tokens will immediately be stakes
                IBooster(poolSettings.convexBooster).depositAll(i, true);
                break;
            }
        }
    }

    function getRewards() override external {
        require(IRewards(poolSettings.crvRewards).getReward(), '!getRewards');
    }

    function canClaim() override external returns(uint256 _amount) {
        _amount = IRewards(poolSettings.crvRewards).earned(address(this));
    }

    function _withdrawSome(uint256 _amount) override internal returns(uint) {
        require(IRewards(poolSettings.crvRewards).withdrawAndUnwrap(_amount, true), '!withdrawSome');
        return _amount;
    }

    function convertTokens(address _for, uint256 _amount) override external {}
}
