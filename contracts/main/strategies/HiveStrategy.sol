pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./BaseStrategy.sol";
import '../interfaces/IAddressProvider.sol';
import '../interfaces/IMainRegistry.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IGaugeLiquidity.sol';
import '../interfaces/IBooster.sol';
import '../interfaces/IRewards.sol';

/// @title HiveStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
contract HiveStrategy is BaseStrategy {

    using SafeERC20 for IERC20;

    using EnumerableSet for EnumerableSet.AddressSet;

    IAddressProvider public addressProvider;
    IMainRegistry public mainRegistry;
    address depositCoin;

    uint64 public constant PCT_BASE = 10 ** 18; 

    struct Pool {
        address lpCurve;
        address liquidityGauge;
        address crvRewards;
        address lpConvex;
        uint8 nCoins;
        uint16 convexId;
    }
    struct Settings  {
        address poolCurve;
        address lpCurve;
        address crvRewards;
        address lpConvex;
        address convexBooster;
        uint8 nCoins; //coins in pool 
        // uint8 idPool;
    }

    //pool address => Pool
    mapping(address => Pool) poolInfo;

    Settings public poolSettings; 

    address public crv;
    address public cvx;
    address public xbe;


    struct HiveWeight{
        uint256 weight;
        address to; 
    }

    HiveWeight[] hiveWeights;
    EnumerableSet.AddressSet poolAddresses; // 

    function configure(
        address _addressProvider,
        address _wantAddress, //in this case it's lP curve 
        address _controllerAddress,
        address _vaultAddress,
        address _governance,
        Settings calldata _poolSettings 
    ) external initializer {
        super.configure(_wantAddress, _controllerAddress, _vaultAddress, _governance);
        addressProvider = IAddressProvider(_addressProvider);
        mainRegistry = IMainRegistry(addressProvider.get_registry());
        poolSettings = _poolSettings;
    }

    
    function skim() override external {
    }
     /// @dev Function that controller calls 
    function deposit() override external onlyController {
        uint256 _amount = IERC20(_want).balanceOf(controller);
        IERC20(_want).transferFrom(controller, address(this), _amount);
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

    function _calculateFee(address _token, uint256 _amount)internal returns(uint256) {
        uint256 value = _amount;
        for(uint256 i = 0; i < hiveWeights.length; i++){
            uint256 _fee = mulDiv(hiveWeights[i].weight, _amount, PCT_BASE);
            value -= _fee;
            //amountFee * value / PCT_BASE
            IERC20(_token).safeTransfer(hiveWeights[i].to, _fee);
        }
        return value;
       
    }

     function _subtractionFee(uint256 _amount) internal view returns(uint256) {
        uint256 value = _amount;
        for(uint256 i = 0; i < hiveWeights.length; i++){
            uint256 _fee = mulDiv(hiveWeights[i].weight, _amount, PCT_BASE);
            value -= _fee;
        }
        return value;
    }


    function earnedWithoutFee(uint256 _crv, uint256 _cvx, uint256 _xbe) external view returns(uint256 crv, uint256 cvx, uint256 xbe) {
        crv = _subtractionFee(_crv);
        cvx =  _subtractionFee(_cvx);
        xbe =_subtractionFee(_xbe);
    }

    function mulDiv (uint x, uint y, uint z)public pure returns (uint) {
        uint a = x / z; uint b = x % z; // x = a * z + b
        uint c = y / z; uint d = y % z; // y = c * z + d
        return a * b * z + a * d + b * c + b * d / z;
    }   

    function canClaimCrv() override external returns(uint256 _crv) {
        _crv = IRewards(poolSettings.crvRewards).earned(address(this));
    }

    function earned() public override returns(uint256 _crv, uint256 _cvx, uint256 _xbe) {
        _crv = IERC20(crv).balanceOf(address(this));
        _cvx = IERC20(cvx).balanceOf(address(this));
        _xbe = IERC20(xbe).balanceOf(address(this));
    }

    function claim(uint256 _crv, uint256 _cvx, uint256 _xbe) override public onlyControllerOrVault returns(bool) {
        address _vault = IController(controller).vaults(_want);
        require(_vault != address(0), "!vault 0");
        if(_crv > 0) {
            uint256 remains = _calculateFee(crv, _crv);
            require(IERC20(crv).transfer(_vault, remains), "!transferCRV");
        }
        if(_cvx > 0){
            require(IERC20(cvx).transfer(_vault, _cvx), "!transferCVX");
        }
         if(_xbe > 0){
            require(IERC20(xbe).transfer(_vault, _xbe), "!transferXBE");
        }
        // 
    }
     
    function _withdrawSome(uint256 _amount) override internal returns(uint) {
        // withdraw from business
        require(IRewards(poolSettings.crvRewards).withdrawAndUnwrap(_amount, true), '!withdrawSome');
        return _amount;
    }

    
    /// @dev To be realised
    function withdrawalFee() override external view returns(uint256) {
        return 0;
    }

}
