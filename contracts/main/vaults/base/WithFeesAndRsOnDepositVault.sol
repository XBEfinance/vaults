pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./BaseVault.sol";
import "../../interfaces/IReferralProgram.sol";
import "../../interfaces/ITreasury.sol";

/// @title WithFeesAndRsOnDepositVault
/// @notice Vault for consumers of the system
contract WithFeesAndRsOnDepositVault is BaseVault {

    using SafeERC20 for IERC20;

    uint64 public constant PCT_BASE = 10 ** 18;
    uint64 public feePercentage;

    address private multisigWallet;

    /// @notice The referral program
    IReferralProgram public referralProgram;
    ITreasury public treasury;

    event SetPercentage(uint64 indexed newPercentage);

    /// @notice Constructor that creates a consumer vault
    constructor(string memory _name, string memory _symbol)
        BaseVault(_name, _symbol) 
        public
    {}

    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        address _referralProgram,
        address _treasury,
        uint256 _rewardsDuration,
        address[] memory _rewardTokens,
        string memory _namePostfix,
        string memory _symbolPostfix
    ) public initializer virtual {
        _configure(
            _initialToken,
            _initialController,
            _governance,
            _rewardsDuration,
            _rewardTokens,
            _namePostfix,
            _symbolPostfix
        );
        referralProgram = IReferralProgram(_referralProgram);
        treasury = ITreasury(_treasury);
        feePercentage = 0;
    }

    function _collectingFee(uint256 _amount) internal returns(uint256 _sumWithoutFee) {
        if(feePercentage > 0) {
            uint256 _fee = mulDiv(feePercentage, _amount, PCT_BASE);
            stakingToken.safeTransfer(multisigWallet, _fee);
            _sumWithoutFee =  _amount.sub(_fee);
        } else {
            _sumWithoutFee = _amount;
        }
    }

     function setFeePercentage(uint64 _newPercentage) external onlyOwner {
        require(_newPercentage < PCT_BASE && _newPercentage != feePercentage,
            'Invalid percentage');
        feePercentage = _newPercentage;
        emit SetPercentage(_newPercentage);
    }

    function mulDiv(uint256 x, uint256 y, uint256 z) public pure returns(uint256) {
        uint256 a = x / z; uint256 b = x % z; // x = a * z + b
        uint256 c = y / z; uint256 d = y % z; // y = c * z + d
        return a * b * z + a * d + b * c + b * d / z;
    }

    function depositFor(uint256 _amount, address _for) override public {
        uint256 _sumWithoutFee = _collectingFee(_amount);
        super.depositFor(_sumWithoutFee, _for);
        (bool _userExists,) = referralProgram.users(_for);
        if(!_userExists){
            referralProgram.registerUser(address(treasury), _for);
        }
    }

    function deposit(uint256 _amount) override public {
        uint256 _sumWithoutFee = _collectingFee(_amount);
        super.deposit(_sumWithoutFee);
        //register in referral program
        (bool _userExists,) = referralProgram.users(msg.sender);
        if(!_userExists){
            referralProgram.registerUser(address(treasury), msg.sender);
        }
    }
}
