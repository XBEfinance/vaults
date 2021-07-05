pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./BaseVault.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IController.sol";
import "../interfaces/IReferralProgram.sol";
import "../interfaces/ITreasury.sol";

/// @title In this case _token it's lp curve;
/// @notice Vault for consumers of the system
contract CVXVault is BaseVault {

    using SafeERC20 for IERC20;

    uint64 public constant PCT_BASE = 10 ** 18;
    uint64 public feePercentage;

    address multisigWallet;

    /// @notice The referral program
    IReferralProgram referralProgram;
    ITreasury treasury;
    address public xbe;

    address[] tokenRewards;
    mapping(address => bool) tokenRewardsM;

    event setPercentage(uint64 indexed newPercentage);
    event addNewTokenReward(address indexed token);
    event RewardPaid(uint256[] indexed rewards);

    /// @notice Constructor that creates a consumer vault
    constructor() BaseVault("Curve", "crv") public {}

    function configure(
        address _initialToken,
        address _initialController,
        address _governance,
        address _referralProgram,
        address _treasury
    ) public initializer {
        _configure(_initialToken, _initialController, _governance);
        referralProgram = IReferralProgram(_referralProgram);
        treasury = ITreasury(_treasury);
        feePercentage = 0;
    }


    function addTokenRewards(address _token) external{
        require(_token != address(0));
        require(!tokenRewardsM[_token], 'token already added');
        tokenRewards.push(_token);
        tokenRewardsM[_token] = true;
        emit addNewTokenReward(_token);
    }

    function _collectingFee(uint256 _amount) internal returns(uint256 _sumWithoutFee) {
        if(feePercentage > 0) {
            uint256 _fee = mulDiv(feePercentage, _amount, PCT_BASE);
            IERC20(_token).safeTransfer(multisigWallet, _fee);
            _sumWithoutFee =  _amount.sub(_fee);
        }
        _sumWithoutFee = _amount;
    }

     function setFeePercentage(uint64 _newPercentage) external onlyOwner {
        require(_newPercentage < PCT_BASE && _newPercentage != feePercentage, 'Invalid percentage');
        feePercentage = _newPercentage;
        emit setPercentage(_newPercentage);
    }

    function mulDiv (uint x, uint y, uint z)public pure returns (uint) {
        uint a = x / z; uint b = x % z; // x = a * z + b
        uint c = y / z; uint d = y % z; // y = c * z + d
        return a * b * z + a * d + b * c + b * d / z;
    }


    function deposit(uint256 _amount) override public {
        uint256 _sumWithoutFee = _collectingFee(_amount);
        super.deposit(_sumWithoutFee);
        //register in referral program
        (bool _userExists,) = referralProgram.users(_msgSender());
        if(!_userExists){
            referralProgram.registerUser(address(treasury), _msgSender());
        }

    }

    function withdraw(uint256 _shares) override public {
        super._withdraw(_msgSender(), _shares);
        claimAll();
    }

    function withdrawAll() override public {
        super._withdraw(_msgSender(), balanceOf(_msgSender()));
        claimAll();
    }

    function claim() public {
        uint256[] memory _amounts = earnedReal();
        _controller.claim(address(_token), _msgSender(), tokenRewards, _amounts);
        for(uint256 i = 0; i < tokenRewards.length; i++){
            IERC20(tokenRewards[i]).safeTransfer(_msgSender(), _amounts[i]);
        }
        emit RewardPaid(_amounts);
    }

    function claimAll() public {
        IStrategy(_controller.strategies(address(_token))).getRewards();
        claim();
    }

    function earnedReal() public returns(uint256[] memory amounts) {
        amounts = IStrategy(
                _controller.strategies(address(_token))
            ).earned(tokenRewards);
        uint256 _share = balanceOf(_msgSender());
        for(uint256 i = 0; i < tokenRewards.length; i++){
            amounts[i] = amounts[i].add(IERC20(tokenRewards[i]).balanceOf(address(this)).mul(_share).div(totalSupply()));
        }
        amounts = IStrategy(_controller.strategies(address(_token))).subFee(amounts);
    }

    function earnedVirtual() external returns(uint256[] memory virtualAmounts){
        uint256[] memory realAmounts = earnedReal();
        uint256[] memory virtualEarned = new uint256[](1);
        virtualEarned[0] = IStrategy(_controller.strategies(address(_token))).canClaim();
        virtualEarned = IStrategy(_controller.strategies(address(_token))).subFee(virtualEarned);
        uint256 _share = balanceOf(_msgSender());
        for(uint256 i = 0; i < tokenRewards.length; i++){
            if(tokenRewards[i] == xbe){
                virtualAmounts[i] = realAmounts[i].mul(_share).div(totalSupply());
            } else {
                virtualAmounts[i] = realAmounts[i].add(virtualEarned[0]).mul(_share).div(totalSupply());
            }
        }
    }
}
