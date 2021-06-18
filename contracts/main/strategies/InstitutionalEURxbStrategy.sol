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

/// @title InstitutionalEURxbStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
contract InstitutionalEURxbStrategy is EURxbStrategy {

    IAddressProvider public addressProvider;
    IMainRegistry public mainRegistry;
    IBooster public convexBooster;
    address depositCoin;

    struct Pool {
        address lpToken;
        address liquidityGauge;
    }
    //pool address => Pool
    mapping(address => Pool) poolInfo;

    constructor(address _addressProvider) public {
        addressProvider = IAddressProvider(_addressProvider);
        mainRegistry = IMainRegistry(addressProvider.get_registry());
    }
    /// @dev To be realised
    function skim() override external {
    }

    /// @dev To be realised
    function deposit(address _token, uint256 _amount) override external {
        (address _lpToken, uint256 _amountLp) = _addLliquidityToCurve(_token, _amount);
        _convertToLp(_lpToken, _amountLp);
    }

    function _convertToCrv(address _pool, address _token, uint256 _amount) internal {
        IGaugeLiquidity _liqGauges = IGaugeLiquidity(poolInfo[_pool].liquidityGauge);
        _liqGauges.deposit(_amount, address(this));
        uint256 _crvAmount = _liqGauges.claimable_tokens(address(this));
    }

    function _convertToLp (address _lpToken, uint256 _amountLp) internal {
        uint256 _poolLength = convexBooster.poolLength();
        IERC20(_lpToken).approve(address(this), _amountLp);
        for(uint256 i = 0; i < _poolLength; i++){
            IBooster.PoolInfo memory _pool = convexBooster.poolInfo(i);
            if(_pool.lptoken == _lpToken){
                convexBooster.deposit(i, _amountLp, true);
            }
        }
        //IBooster.PoolInfo = convexBooster

    }

    function _addLliquidityToCurve(address _token, uint256 _amount) internal returns(address, uint256 ){
        uint256 _poolCount = mainRegistry.pool_count();
        address[] memory _poolList = mainRegistry.pool_list();
        for(uint256 i = 0; i < _poolCount; i++){
            IPool _poolAddress = IPool(_poolList[i]);
            uint128 _coinsLength = 8;
            uint256[] memory _coinsAmounts = new uint256[](_coinsLength);
            for(uint256 l = 0; l < _coinsLength; i++){
                address _coin = _poolAddress.coins(int128(i));
                if(_token == _coin){
                    _coinsAmounts[l] = _amount;
                    _poolAddress.add_liquidity(_coinsAmounts, 0); 
                    uint256 _lpAmount = IERC20(poolInfo[address(_poolAddress)].lpToken).balanceOf(address(this));
                    return (poolInfo[address(_poolAddress)].lpToken, _lpAmount);
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
