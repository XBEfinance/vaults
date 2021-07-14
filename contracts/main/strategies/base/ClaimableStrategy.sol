pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./BaseStrategy.sol";
import '../../interfaces/ITreasury.sol';
import '../../interfaces/IRewards.sol';
import "../../interfaces/IVoting.sol";

/// @title ClaimableStrategy
/// @notice This is contract for yield farming strategy with EURxb token for investors
abstract contract ClaimableStrategy is BaseStrategy {

    uint64 public constant PCT_BASE = 10 ** 18;

    struct FeeWeight {
        uint256 weight;
        address to;
        mapping(address => bool) tokens;
        bool callFunc;
    }

    FeeWeight[] internal feeWeights;

    uint64 public countReceiver;
    uint256 public sumWeight;
    address public tokenToAutostake;
    address public voting;

    function _configure(
        address _wantAddress, //in this case it's lP curve
        address _controllerAddress,
        address _vaultAddress,
        address _governance,
        address _tokenToAutostake,
        address _voting
    ) internal {
        _configure(_wantAddress, _controllerAddress, _vaultAddress, _governance);
        tokenToAutostake = _tokenToAutostake;
        voting = _voting;
    }

    function addFeeReceiver(address _to, uint256 _weight, address[] calldata _tokens, bool _callFunc) external onlyOwner {
        require(sumWeight.add(_weight) < PCT_BASE, '!weight < PCT_BASE');
        FeeWeight storage newWeight;
        newWeight.to = _to;
        newWeight.weight = _weight;
        newWeight.callFunc = _callFunc;
        for(uint256 i = 0; i < _tokens.length; i++){
            newWeight.tokens[_tokens[i]] = true;
        }
        feeWeights.push(newWeight);
        countReceiver++;
    }

    function removeFeeReceiver(uint256 _index) external onlyOwner {
        sumWeight = sumWeight.sub(feeWeights[_index].weight);
        delete feeWeights[_index];
        countReceiver--;
    }

    function setWeight(uint256 _index, uint256 _weight) external onlyOwner {
        uint256 oldWeight = feeWeights[_index].weight;
        if (oldWeight > _weight) {
            sumWeight = sumWeight.sub(oldWeight.sub(_weight));
        } else if (oldWeight < _weight) {
            sumWeight = sumWeight.add(_weight.sub(oldWeight));
            require(sumWeight < PCT_BASE);
        }
        feeWeights[_index].weight = _weight;
    }

    //returns sub fee
    function _distributeFee(address _for, address[] memory _tokens, uint256[] memory _amounts) internal returns(uint256[] memory) {
        require(_tokens.length == _amounts.length, '!length');
        uint256[] memory _fees = new uint256[](_tokens.length);
        for(uint256 j = 0; j < feeWeights.length; j++) {
            for(uint256 i = 0; i < _tokens.length; i++) {
                // weight * amounts / PCT_BASE
                uint256 _fee = mulDiv(feeWeights[i].weight, _amounts[i], PCT_BASE);
                _fees[i] = _fee;
                if(feeWeights[j].tokens[_tokens[i]]){
                    IERC20(_tokens[i]).safeTransfer(feeWeights[i].to, _fee);
                }
                _amounts[i] = _amounts[i].sub(_fee);
            }
            if(feeWeights[j].callFunc){
                ITreasury(feeWeights[j].to).feeReceiving(_for, _tokens, _fees);
            }
        }
        return _amounts;
    }

    function mulDiv(uint256 x, uint256 y, uint256 z) public pure returns(uint256) {
        uint256 a = x / z; uint256 b = x % z; // x = a * z + b
        uint256 c = y / z; uint256 d = y % z; // y = c * z + d
        return a * b * z + a * d + b * c + b * d / z;
    }

    function earned(address[] memory _tokens) public view override returns(uint256[] memory _amounts) {
         _amounts = new uint256[](_tokens.length);
         for(uint256 i = 0; i < _tokens.length; i++){
             _amounts[i] = IERC20(_tokens[i]).balanceOf(address(this));
         }
     }

    function subFee(uint256[] memory _amounts) override public view returns(uint256[] memory){
       for(uint256 i = 0; i < _amounts.length; i++) {
           uint256 value = _amounts[i];
           for(uint256 j = 0; j < feeWeights.length; j++){
               uint256 _fee = mulDiv(feeWeights[j].weight, _amounts[i], PCT_BASE);
               value -= _fee;
           }
           _amounts[i] = value;
       }
       return _amounts;
  }

  function claim(address _for, address[] memory _tokens, uint256[] memory _amounts) override public onlyControllerOrVault returns(bool) {
      address _vault = IController(controller).vaults(_want);
      require(_vault != address(0), "!vault 0");

      uint256[] memory amountsWithoutFee = _distributeFee(_for, _tokens, _amounts);
      for(uint256 i = 0; i < _tokens.length; i++){
          if(amountsWithoutFee[i] > 0){
              if (_tokens[i] == tokenToAutostake) {
                  IERC20(_tokens[i]).approve(voting, amountsWithoutFee[i]);
                  IVoting(voting).stakeFor(_for, amountsWithoutFee[i]);
              } else {
                  require(IERC20(_tokens[i]).transfer(_vault, amountsWithoutFee[i]), "!transfer");
              }
          }
      }
      return true;
  }
}
