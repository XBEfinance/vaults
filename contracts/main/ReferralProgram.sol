pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRegistry.sol";

contract ReferralProgram is Initializable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct User {
        bool exists;
        address referrer;
    }

    mapping(address => User) public users;
    // user_address -> token_address -> token_amount
    mapping(address => mapping(address => uint256)) public rewards;

    uint256[] public distribution = [70, 20, 10];
    address[] public tokens;

    address public rootAddress;
    address public admin;
    IRegistry public registry;

    modifier onlyAdmin() {
        require(msg.sender == admin, "RP!admin");
        _;
    }

    modifier onlyFeeDistributors() {
        address[] memory distributors = getFeeDistributors();
        bool approved;
        for (uint256 i = 0; i < distributors.length; i++) {
            if (msg.sender == distributors[i]) {
                approved = true;
                break;
            }
        }
        require(approved, "RP!feeDistributor");
        _;
    }

    event RegisterUser(address user, address referrer);
    event RewardReceived(address user, address token, uint256 amount);
    event RewardsClaimed(address user, address[] tokens, uint256[] amounts);
    event TransferOwnership(address admin);
    event NewDistribution(uint256[] distribution);
    event NewToken(address token);

    function configure(
        address[] calldata tokenAddresses,
        address _rootAddress,
        address _registry
    ) external initializer {
        admin = msg.sender;
        require(_rootAddress != address(0), "RProotIsZero");
        require(_registry != address(0), "RPregistryIsZero");
        require(tokenAddresses.length > 0, "RPtokensNotProvided");

        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            require(tokenAddresses[i] != address(0), "RPtokenIsZero");
        }

        tokens = tokenAddresses;

        registry = IRegistry(_registry);

        rootAddress = _rootAddress;
        users[rootAddress] = User({exists: true, referrer: rootAddress});
    }

    function getFeeDistributors() public view returns (address[] memory) {
        (address[] memory distributors, , , , , ) = registry.getVaultsInfo();
        return distributors;
    }

    function registerUser(address referrer, address referral)
        public
        onlyFeeDistributors
    {
        _registerUser(referrer, referral);
    }

    function registerUser(address referrer) public {
        _registerUser(referrer, msg.sender);
    }

    function _registerUser(address referrer, address referral) internal {
        require(referral != address(0), "RPuserIsZero");
        require(!users[referral].exists, "RPuserExists");
        require(users[referrer].exists, "RP!referrerExists");
        users[referral] = User({exists: true, referrer: referrer});
        emit RegisterUser(referral, referrer);
    }

    function feeReceiving(
        address _for,
        address _token,
        uint256 _amount
    ) external onlyFeeDistributors {
        // If notify reward for unregistered _for -> register with root referrer
        if (!users[_for].exists) {
            _registerUser(rootAddress, _for);
        }

        address upline = users[_for].referrer;
        for (uint256 i = 0; i < distribution.length; i++) {
            uint256 amount = rewards[upline][_token].add(
                _amount.div(100).mul(distribution[i])
            );
            rewards[upline][_token] = amount;

            emit RewardReceived(upline, _token, amount);
            upline = users[upline].referrer;
        }
    }

    function claimRewardsFor(address userAddr) public nonReentrant {
        require(users[userAddr].exists, "RP!userExists");
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            if (rewards[userAddr][tokens[i]] > 0) {
                amounts[i] = rewards[userAddr][tokens[i]];
                if (rewards[userAddr][tokens[i]] > 0) {
                    IERC20(tokens[i]).safeTransfer(
                        userAddr,
                        rewards[userAddr][tokens[i]]
                    );
                    rewards[userAddr][tokens[i]] = 0;
                }
            }
        }
        emit RewardsClaimed(userAddr, tokens, amounts);
    }

    function claimRewards() public {
        claimRewardsFor(msg.sender);
    }

    function claimRewardsForRoot() public {
        claimRewardsFor(rootAddress);
    }

    function getTokensList() public view returns (address[] memory) {
        return tokens;
    }

    function getDistributionList() public view returns (uint256[] memory) {
        return distribution;
    }

    function transferOwnership(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "RPadminIsZero");
        admin = newAdmin;
        emit TransferOwnership(admin);
    }

    function changeDistribution(uint256[] calldata newDistribution)
        external
        onlyAdmin
    {
        uint256 sum;
        for (uint256 i = 0; i < newDistribution.length; i++) {
            sum = sum.add(newDistribution[i]);
        }
        require(sum == 100, "RP!fullDistribution");
        distribution = newDistribution;
        emit NewDistribution(distribution);
    }

    function addNewToken(address tokenAddress) external onlyAdmin {
        require(tokenAddress != address(0), "RPtokenIsZero");
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokenAddress != tokens[i], "RPtokenAlreadyExists");
        }
        tokens.push(tokenAddress);
        emit NewToken(tokenAddress);
    }
}
