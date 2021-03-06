pragma solidity ^0.6.0;

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
import '../interfaces/ITreasury.sol';
import "../interfaces/IReferralProgram.sol";
import "../interfaces/IVoting.sol";

/// @title HiveStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
contract HiveStrategy is BaseStrategy {

    using SafeERC20 for IERC20;

    using EnumerableSet for EnumerableSet.AddressSet;

    IAddressProvider public addressProvider;
    IMainRegistry public mainRegistry;

    uint64 public constant PCT_BASE = 10 ** 18;

    struct Settings  {
        address poolCurve;
        address lpCurve;
        address crvRewards;
        address lpConvex;
        address convexBooster;
        uint8 nCoins; //coins in pool
        // uint8 idPool;
    }

    struct HiveWeight{
        uint256 weight;
        address to;
        mapping(address => bool) tokens;
        bool callFunc;
    }

    Settings public poolSettings;
    HiveWeight[] hiveWeights;

    uint64 public countReceiver;
    uint256 public sumWeight;
    address public xbe;

    function configure(
        address _addressProvider,
        address _wantAddress, //in this case it's lP curve
        address _controllerAddress,
        address _governance,
        address _xbe,
        Settings memory _poolSettings
    ) public initializer {
        _configure(_wantAddress, _controllerAddress, _governance);
        addressProvider = IAddressProvider(_addressProvider);
        poolSettings = _poolSettings;
        xbe = _xbe;
    }

    function setMainRegistry(address _mainRegistry) external onlyOwner {
        mainRegistry = IMainRegistry(_mainRegistry);
    }

    function addFeeReceiver(address _to, uint256 _weight, address[] calldata _tokens, bool _callFunc) external onlyOwner {
        require(sumWeight.add(_weight) < PCT_BASE, '!weight < PCT_BASE');
        HiveWeight storage newWeight;
        newWeight.to = _to;
        newWeight.weight = _weight;
        newWeight.callFunc = _callFunc;
        for(uint256 i = 0; i < _tokens.length; i++){
            newWeight.tokens[_tokens[i]] = true;
        }
        hiveWeights.push(newWeight);
        countReceiver++;
    }

    function removeFeeReceiver(uint256 _index) external onlyOwner {
        sumWeight = sumWeight.sub(hiveWeights[_index].weight);
        delete hiveWeights[_index];
        countReceiver--;
    }

    function setWeight(uint256 _index, uint256 _weight) external onlyOwner {
        uint256 oldWeight = hiveWeights[_index].weight;
        if (oldWeight > _weight) {
            sumWeight = sumWeight.sub(oldWeight.sub(_weight));
        } else if (oldWeight < _weight) {
            sumWeight = sumWeight.add(_weight.sub(oldWeight));
            require(sumWeight < PCT_BASE);
        }
        hiveWeights[_index].weight = _weight;
    }

    function skim() override external {}


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


    //returns sub fee
    function _distributeFee(address _for, address[] memory _tokens, uint256[] memory _amounts) internal returns(uint256[] memory) {
        require(_tokens.length == _amounts.length, '!length');
        uint256[] memory _fees = new uint256[](_tokens.length);
        for(uint256 j = 0; j < hiveWeights.length; j++) {
            for(uint256 i = 0; i < _tokens.length; i++) {
                //weight * amounts / PCT_BASE
                uint256 _fee = mulDiv(hiveWeights[i].weight, _amounts[i], PCT_BASE);
                _fees[i] = _fee;
                if(hiveWeights[j].tokens[_tokens[i]]){
                    IERC20(_tokens[i]).safeTransfer(hiveWeights[i].to, _fee);
                }
                _amounts[i] = _amounts[i].sub(_fee);
            }
            if(hiveWeights[j].callFunc){
                //TO-DO to create specific interface
                ITreasury(hiveWeights[j].to).convertToRewardsToken(_tokens, _fees);
            }
        }
        return _amounts;
    }

     function subFee(uint256[] memory _amounts) override public view returns(uint256[] memory){
        for(uint256 i = 0; i < _amounts.length; i++) {
            uint256 value = _amounts[i];
            for(uint256 j = 0; j < hiveWeights.length; j++){
                uint256 _fee = mulDiv(hiveWeights[j].weight, _amounts[i], PCT_BASE);
                value = value.sub(_fee);
            }
            _amounts[i] = value;
        }
        return _amounts;
    }

    function mulDiv (uint x, uint y, uint z)public pure returns (uint) {
        uint a = x / z; uint b = x % z; // x = a * z + b
        uint c = y / z; uint d = y % z; // y = c * z + d
        return a * b * z + a * d + b * c + b * d / z;
    }

    function canClaim() override external returns(uint256 _amount) {
        _amount = IRewards(poolSettings.crvRewards).earned(address(this));
    }

   function earned(address[] memory _tokens) external override returns(uint256[] memory _amounts) {
        for(uint256 i = 0; i < _tokens.length; i++){
            _amounts[i] = IERC20(_tokens[i]).balanceOf(address(this));
        }
    }

    function claim(address _for, address[] memory  _tokens , uint256[] memory _amounts) override public onlyControllerOrVault returns(bool) {
        address _vault = IController(controller).vaults(_want);
        require(_vault != address(0), "!vault 0");

        uint256[] memory amountsWithoutFee = _distributeFee(_for, _tokens, _amounts);
        for(uint256 i = 0; i < _tokens.length; i++){
            if(amountsWithoutFee[i] > 0){
                if (_tokens[i] == xbe) {
                    IERC20(_tokens[i]).approve(voting, amountsWithoutFee[i]);
                    Voting(voting).stakeFor(_for, amountsWithoutFee[i]);
                } else {
                    require(IERC20(_tokens[i]).transfer(_vault, amountsWithoutFee[i]), "!transfer");
                }
            }
        }
        return true;
    }


    function _withdrawSome(uint256 _amount) override internal returns(uint) {
        require(IRewards(poolSettings.crvRewards).withdrawAndUnwrap(_amount, true), '!withdrawSome');
        return _amount;
    }

    function convertTokens(address _for, uint256 _amount) override external {
    }

    /// @dev To be realised
    function withdrawalFee() override external view returns(uint256) {
        return 0;
    }

}
