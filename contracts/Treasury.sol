pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./governance/Governable.sol";
import "./governance/Governance.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IOneSplitAudit.sol";

/// @title Treasury
/// @notice
contract Treasury is Governable, Initializable, Context, ITreasury {

    using SafeMath for uint256256;
    using Address for address;
    using SafeERC20 for IERC20;

    address public governance;
    address public oneSplit;
    address public governanceContract;
    address public rewardsToken;

    mapping(address => bool) authorized;

    modifier authorizedOnly {
      require(authorized[_msgSender()], "!authorized");
      _;
    }

    function configure(address _governance, address _oneSplit) external initializer {
        setGovernance(_governance);
        setOneSplit(_oneSplit);
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

    function setGovernanceContract(address _governanceContract) public onlyGovernance {
      governanceContract = _governanceContract;
    }

    function revokeAuthorized(address _authorized) external onlyGovernance {
        authorized[_authorized] = false;
    }

    function toGovernance(address _token, uint256 _amount) external onlyGovernance {
        IERC20(_token).safeTransfer(governance, _amount);
    }

    function toVoters() external {
        uint256 _balance = IERC20(rewardsToken).balanceOf(address(this));
        IERC20(rewardsToken).safeApprove(governanceContract, 0);
        IERC20(rewardsToken).safeApprove(governanceContract, _balance);
        Governance(governanceContract).notifyRewardAmount(_balance);
    }

    function getExpectedReturn(address _from, address _to, uint256 parts) external view returns(uint256 expected) {
        uint256 _balance = IERC20(_from).balanceOf(address(this));
        (expected,) = OneSplitAudit(onesplit).getExpectedReturn(_from, _to, _balance, parts, 0);
    }

    // Only allows to withdraw non-core strategy tokens ~ this is over and above normal yield
    function convert(address _from, uint256 _parts) external authorizedOnly {
        uint256 _amount = IERC20(_from).balanceOf(address(this));
        uint256[] memory _distribution;
        uint256 _expected;
        IERC20(_from).safeApprove(oneSplit, 0);
        IERC20(_from).safeApprove(oneSplit, _amount);
        (_expected, _distribution) = IOneSplitAudit(oneSplit).getExpectedReturn(_from, rewardsToken, _amount, _parts, 0);
        IOneSplitAudit(onesplit).swap(_from, rewards, _amount, _expected, _distribution, 0);
    }
}
