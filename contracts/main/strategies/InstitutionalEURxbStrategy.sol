pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./EURxbStrategy.sol";
import '../interfaces/IAddressProvider.sol';
import '../interfaces/IMainRegistry.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IGaugeLiquidity.sol';
import '../interfaces/IBooster.sol';
import '../interfaces/IRewards.sol';

/// @title InstitutionalEURxbStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
contract InstitutionalEURxbStrategy is EURxbStrategy {

    IAddressProvider public addressProvider;
    IMainRegistry public mainRegistry;
    IBooster public convexBooster;
    address depositCoin;

    struct Pool {
        address lpCurve;
        address liquidityGauge;
        address crvRewards;
        address lpConvex;
        uint8 nCoins;
        uint16 convexId;
    }
    //pool address => Pool
    mapping(address => Pool) poolInfo;
    address[] public poolAddresses;

    constructor(address _addressProvider) public {
        addressProvider = IAddressProvider(_addressProvider);
        mainRegistry = IMainRegistry(addressProvider.get_registry());
    }
    /// @dev To be realised
    function skim() override external {
    }
     /// @dev To be realised
    function deposit(address _token, uint256 _amount) override external {
        
    }
    /// @dev To be realised
    function depositERC(address _token, uint256 _amount) external {
        require(_token != address(0), 'address == 0');
        require(_amount > 0, 'amount == 0');
        (address _lpToken, uint256 _amountLp) = _addLiquidityToCurve(_token, _amount);
        _convertToConvexLp(_lpToken, _amountLp);
    }

    function depositConvexLp(address _lpToken, uint256 _amount) external {
        uint256 _poolLength = convexBooster.poolLength();
        IERC20(_lpToken).transferFrom(msg.sender, address(this), _amount);
        for(uint256 i = 0; i < _poolLength; i++){
            IBooster.PoolInfo memory _pool = convexBooster.poolInfo(i);
            if(_pool.token == _lpToken){
                address _rewardContract = _pool.crvRewards;
                IERC20(_lpToken).approve(_rewardContract, _amount);
                IRewards(_rewardContract).stakeFor(address(this), _amount);
                break;
            }
        }
    }
    //for second strategy 
    function _convertToCrv(address _pool, address _token, uint256 _amount) internal {
        IGaugeLiquidity _liqGauges = IGaugeLiquidity(poolInfo[_pool].liquidityGauge);
        _liqGauges.deposit(_amount, address(this));
        uint256 _crvAmount = _liqGauges.claimable_tokens(address(this));
    }

    function _convertToConvexLp (address _lpToken, uint256 _amountLp) internal {
        uint256 _poolLength = convexBooster.poolLength();
        IERC20(_lpToken).approve(address(convexBooster), _amountLp);
        for(uint256 i = 0; i < _poolLength; i++){
            IBooster.PoolInfo memory _pool = convexBooster.poolInfo(i);
            if(_pool.lptoken == _lpToken){
                //true means that the received lp tokens will immediately be stakes
                convexBooster.deposit(i, _amountLp, true);
            }
        }
    }

    function _addLiquidityToCurve(address _token, uint256 _amount) internal returns(address, uint256 ){
        uint256 _poolCount = mainRegistry.pool_count();
        address[] memory _poolList = new address[](_poolCount);
        _poolList = mainRegistry.pool_list();
        for(uint256 i = 0; i < _poolCount; i++){
            IPool _poolAddress = IPool(_poolList[i]);
            uint8 _nCoins = poolInfo[address(_poolAddress)].nCoins;
            //required for passing as an argument
            uint256[] memory _coinsAmount = new uint256[](_nCoins);
            for(uint256 l = 0; l < _nCoins; i++){
                address _coin = _poolAddress.coins(int128(i));
                if(_token == _coin){
                    _coinsAmount[l] = _amount;
                    _poolAddress.add_liquidity(_coinsAmount, 0); 
                    uint256 _lpAmount = IERC20(poolInfo[address(_poolAddress)].lpCurve).balanceOf(address(this));
                    return (poolInfo[address(_poolAddress)].lpCurve, _lpAmount);
                }
            }
        }
    }
    /// @dev To be realised
    function withdrawalFee() override external view returns(uint256) {
        return 0;
    }

    function _withdrawSome(uint256 _amount) override internal returns(uint) {
        // withdraw from business
        return _amount;
    }

}
