pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./utils/Authorizable.sol";

/// @title WithFeesAndRsOnDepositVault
/// @notice Vault for consumers of the system
abstract contract VaultWithFeesOnDeposit is Authorizable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint64 public feePercentage;
    address private teamWallet;

    uint64 public constant PCT_BASE = 10**18;

    event SetPercentage(uint64 indexed newPercentage);

    function _configureVaultWithFeesOnDeposit(address _teamWallet) internal {
        teamWallet = _teamWallet;
        feePercentage = 0;
    }

    function _getFeeForDepositAndSendIt(IERC20 _stakingToken, uint256 _amount)
        internal
        returns (uint256 _sumWithoutFee)
    {
        if (feePercentage > 0) {
            uint256 _fee = _mulDiv1(feePercentage, _amount, PCT_BASE);
            _stakingToken.safeTransfer(teamWallet, _fee);
            _sumWithoutFee = _amount.sub(_fee);
        } else {
            _sumWithoutFee = _amount;
        }
    }

    function setFeePercentage(uint64 _newPercentage) external auth(msg.sender) {
        require(
            _newPercentage < PCT_BASE && _newPercentage != feePercentage,
            "Invalid percentage"
        );
        feePercentage = _newPercentage;
        emit SetPercentage(_newPercentage);
    }

    function _mulDiv1(
        uint256 x,
        uint256 y,
        uint256 z
    ) internal pure returns (uint256) {
        return x.mul(y).div(z);
    }
}
