pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./utils/Authorizable.sol";
import "../../interfaces/ITreasury.sol";

/// @title WithFeesAndRsOnDepositVault
/// @notice Vault for consumers of the system
abstract contract VaultWithFeesOnClaim is Authorizable {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint64 public constant PCT_PRECISION = 10 ** 18;

    struct FeeWeight {
        uint256 weight;
        address to;
        mapping(address => bool) tokens;
        bool callFunc;
    }

    FeeWeight[] internal feeWeights;

    uint64 public countReceiver;
    uint256 public sumWeight;
    bool public feesEnabled;

    function _configureVaultWithFeesOnClaim(
        bool _enableFees
    ) internal {
        feesEnabled = _enableFees;
    }

    function setFeesEnabled(bool _isFeesEnabled) external auth(msg.sender) {
        feesEnabled = _isFeesEnabled;
    }

    function addFeeReceiver(address _to, uint256 _weight, address[] calldata _tokens, bool _callFunc) external auth(msg.sender) {
        require(sumWeight.add(_weight) < PCT_PRECISION, '!weight < PCT_PRECISION');
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

    function removeFeeReceiver(uint256 _index) external auth(msg.sender) {
        sumWeight = sumWeight.sub(feeWeights[_index].weight);
        delete feeWeights[_index];
        countReceiver--;
    }

    function setWeight(uint256 _index, uint256 _weight) external auth(msg.sender) {
        uint256 oldWeight = feeWeights[_index].weight;
        if (oldWeight > _weight) {
            sumWeight = sumWeight.sub(oldWeight.sub(_weight));
        } else if (oldWeight < _weight) {
            sumWeight = sumWeight.add(_weight.sub(oldWeight));
            require(sumWeight < PCT_PRECISION, "invalidSumWeight");
        }
        feeWeights[_index].weight = _weight;
    }

    function _getAndDistributeFeesOnClaimForToken(
        address _for,
        address _rewardToken,
        uint256 _amount
    ) internal returns(uint256) {
        if (!feesEnabled) {
            return _amount;
        }
        uint256 fee;
        for (uint256 i = 0; i < feeWeights.length; i++) {
            fee = _mulDiv(feeWeights[i].weight, _amount, PCT_PRECISION);
            if(feeWeights[i].tokens[_rewardToken]){
                IERC20(_rewardToken).safeTransfer(feeWeights[i].to, fee);
            }
            _amount = _amount.sub(fee);
            if(feeWeights[i].callFunc) {
                ITreasury(feeWeights[i].to).feeReceiving(_for, _rewardToken, fee);
            }
        }
        return _amount;
    }

    function subFeeForClaim(uint256[] memory _amounts) public view returns(uint256[] memory){
        if (!feesEnabled) {
            return _amounts;
        }
        for(uint256 i = 0; i < _amounts.length; i++) {
           uint256 value = _amounts[i];
           for(uint256 j = 0; j < feeWeights.length; j++){
               uint256 _fee = _mulDiv(feeWeights[j].weight, _amounts[i], PCT_PRECISION);
               value -= _fee;
           }
           _amounts[i] = value;
        }
        return _amounts;
    }

    function _mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns(uint256) {
        return x.mul(y).div(z);
    }
}
