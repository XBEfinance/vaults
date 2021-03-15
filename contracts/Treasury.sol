pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./governance/Governable.sol";
import "./governance/Governance.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IOneSplitAudit.sol";

/// @title Treasury
/// @notice Realisation of ITreasury for channeling managing fees from strategies to gov and governance address
contract Treasury is Governable, Initializable, Context, ITreasury {

    using SafeERC20 for IERC20;

    address public oneSplit;
    address public governanceContract;
    address public rewardsToken;

    mapping(address => bool) authorized;

    modifier authorizedOnly {
      require(authorized[_msgSender()], "!authorized");
      _;
    }

    function configure(
        address _governance,
        address _oneSplit,
        address _governanceContract,
        address _rewardsToken
      ) external initializer {
        setGovernance(_governance);
        setOneSplit(_oneSplit);
        setGovernanceContract(_governanceContract);
        setRewardsToken(_rewardsToken);
        setAuthorized(_governance);
    }

    function setOneSplit(address _oneSplit) public onlyGovernance {
        oneSplit = _oneSplit;
    }

    function setRewardsToken(address _rewardsToken) public onlyGovernance {
        rewardsToken = _rewardsToken;
    }

    function setAuthorized(address _authorized) public onlyGovernance {
        authorized[_authorized] = true;
    }

    function revokeAuthorized(address _authorized) external onlyGovernance {
        authorized[_authorized] = false;
    }

    function setGovernanceContract(address _governanceContract) public onlyGovernance {
        governanceContract = _governanceContract;
    }

    function toGovernance(address _token, uint256 _amount) override external onlyGovernance {
        IERC20(_token).safeTransfer(governance, _amount);
    }

    function toVoters() override external {
        uint256 _balance = IERC20(rewardsToken).balanceOf(address(this));
        IERC20(rewardsToken).safeApprove(governanceContract, 0);
        IERC20(rewardsToken).safeApprove(governanceContract, _balance);
        Governance(governanceContract).notifyRewardAmount(_balance);
    }

    function getExpectedReturn(address _from, address _to, uint256 parts) external view returns(uint256 expected) {
        uint256 _balance = IERC20(_from).balanceOf(address(this));
        (expected,) = IOneSplitAudit(oneSplit).getExpectedReturn(_from, _to, _balance, parts, 0);
    }

    // Only allows to withdraw non-core strategy tokens ~ this is over and above normal yield
    function convert(address _from, uint256 _parts) override external authorizedOnly {
        uint256 _amount = IERC20(_from).balanceOf(address(this));
        uint256[] memory _distribution;
        uint256 _expected;
        IERC20(_from).safeApprove(oneSplit, 0);
        IERC20(_from).safeApprove(oneSplit, _amount);
        (_expected, _distribution) = IOneSplitAudit(oneSplit).getExpectedReturn(_from, rewardsToken, _amount, _parts, 0);
        IOneSplitAudit(oneSplit).swap(_from, rewardsToken, _amount, _expected, _distribution, 0);
    }
}
