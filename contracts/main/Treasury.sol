pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "@uniswap/v2-periphery/contracts/UniswapV2Router02.sol";
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol';

import "./staking_rewards/RewardsDistributionRecipient.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IVoting.sol";

/// @title Treasury
/// @notice Realisation of ITreasury for channeling managing fees from strategies to gov and governance address
contract Treasury is Initializable, Ownable, ITreasury {

    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => bool) public authorized;
    UniswapV2Router02 public uniswapRouter;

    address public rewardsDistributionRecipientContract;
    address public rewardsToken;
    address public xbe;
    address public voting;
    uint256 public constant MAX_BPS = 10000;

    uint256 public slippageTolerance; // in bps, ex. 9500 equals 5% slippage tolerance
    uint256 public swapDeadline; // in seconds

    EnumerableSet.AddressSet internal _tokensToConvert;

    mapping(address => bool) public authorized;

    modifier authorizedOnly {
      require(authorized[_msgSender()], "!authorized");
      _;
    }

    function configure(
        address _governance,
        address _rewardsDistributionRecipientContract,
        address _rewardsToken,
        address _uniswapRouter,
        address _xbe,
        address _voting,
        uint256 _slippageTolerance,
        uint256 _swapDeadline
    ) external initializer {
        transferOwnership(_governance);
        setOneSplit(_oneSplit);
        setRewardsDistributionRecipientContract(rewardsDistributionRecipientContract);
        setRewardsToken(_rewardsToken);
        setAuthorized(_governance, true);
        uniswapRouter = UniswapV2Router02(_uniswapRouter);
        slippageTolerance = _slippageTolerance;
        swapDeadline = _swapDeadline;
        xbe = _xbe;
        voting = _voting;
    }

    function setRewardsToken(address _rewardsToken) public onlyOwner {
        rewardsToken = _rewardsToken;
    }

    function setRewardsDistributionRecipientContract(address _rewardsDistributionRecipientContract) public onlyOwner {
        rewardsDistributionRecipientContract = _rewardsDistributionRecipientContract;
    }

    function setAuthorized(address _authorized, bool status) public onlyOwner {
        authorized[_authorized] = status;
    }

    function addTokenToConvert(address _token) external onlyOwner {
        _tokensToConvert.add(_token);
    }

    function removeTokenToConvert(address _token) external onlyOwner {
        _tokensToConvert.remove(_token);
    }

    function feeReceiving(address _for, address[] _tokens, uint256[] _amounts) external {
        for(uint256 i = 0; i < _tokens.length; i++){
            if(_tokens[i] == xbe){
                IERC20(xbe).transfer(voting, _amounts[i]);
                IVoting(voting).stakeFor(_for, _amounts[i]);
            } else {
                convertToRewardsToken(_tokens[i], _amounts[i]);
            }
        }
    }

    function convertToRewardsToken(address _token, uint256 amount) external authorizedOnly {
        require(_tokensToConvert.contains(_token), "tokenIsNotAllowed");

        address[] memory path = new address[](3);
        path[0] = _token;
        path[1] = uniswapRouter.WETH();
        path[2] = rewardsToken;

        uint256 amountOutMin = UniswapV2Library.getAmountsOut(amount, path)[0];
        amountOutMin = (amountOutMin * slippageTolerance) / MAX_BPS;

        IERC20(_token).safeTransfer(address(uniswapRouter), amount);
        uniswapRouter.swapExactTokensForTokens(
          amount,
          amountOutMin,
          path,
          address(this),
          block.timestamp + swapDeadline
        );
    }

    function toGovernance(address _token, uint256 _amount) override external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    function toVoters() override external {
        uint256 _balance = IERC20(rewardsToken).balanceOf(address(this));
        IERC20(rewardsToken).safeApprove(rewardsDistributionRecipientContract, 0);
        IERC20(rewardsToken).safeApprove(rewardsDistributionRecipientContract, _balance);
        IERC20(rewardsToken).safeTransfer(rewardsDistributionRecipientContract, _balance);
        RewardsDistributionRecipient(rewardsDistributionRecipientContract).notifyRewardAmount(_balance);
    }

}
