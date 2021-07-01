pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ReferralProgram is Initializable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct User {
        bool exists;
        address referrer;
    }

    event CommitOwnership(address admin);
    event ApplyOwnership(address admin);
    event CommitDistribution(uint256[] distribution);
    event ApplyDistribution(uint256[] distribution);
    event CommitNewToken(address token);
    event ApplyNewToken(address token);

    mapping(address => User) public users;

    // user_address -> token_address -> token_amount
    mapping (address => mapping(address => uint256)) public rewards;

    uint256[] public distribution = [70, 20, 10];
    uint256[] public futureDistribution;

    address[] public tokens;
    address public newToken;

    address private rootAddress;

    address public admin;
    address public futureAdmin;

    modifier onlyAdmin {
      require(msg.sender == admin, "!admin");
      _;
    }

    function configure(
        address[] calldata tokenAddresses,
        address _rootAddress
    ) external initializer {
        admin = msg.sender;
        require(_rootAddress != address(0), 'rootIsZero');
        require(tokenAddresses.length > 0, 'tokensNotProvided');

        for(uint256 i = 0; i < tokenAddresses.length; i++){
            require(tokenAddresses[i] != address(0), 'tokenIsZero');
        }

        tokens = tokenAddresses;

        rootAddress = _rootAddress;
        users[rootAddress] = User({
            exists: true,
            referrer: rootAddress
        });
    }

    // TODO: restrict usage to onlyVault
    function registerUser(
        address referrer,
        address referral
    ) public {
        _registerUser(referrer, referral);
    }

    function registerUser(address referrer) public {
        _registerUser(referrer, msg.sender);
    }

    function _registerUser(
        address referrer,
        address referral
    ) internal {
        require(!users[referral].exists, 'RPuserExists');
        require(users[referrer].exists, 'RP!referrerExists');
        users[msg.sender] = User({
            exists: true,
            referrer: referrer
        });
    }

    // TODO: restrict usage by address list
    function feeReceiving(
        address _for, address[] calldata _tokens, uint256[] calldata _amounts
    ) external {
        require(_amounts.length == _tokens.length, 'RP!AmountsLength');
        // If notify reward for unregistered _for -> register with root referrer
        if(!users[_for].exists){
            users[_for] = User({
                exists: true,
                referrer: rootAddress
            });
        }

        address upline = users[_for].referrer;
        for(uint256 i = 0; i < distribution.length; i++){
            for(uint256 j = 0; j < _tokens.length; j++){
                rewards[upline][_tokens[j]] = rewards[upline][_tokens[j]]
                    .add(_amounts[j].div(100).mul(distribution[i]));
            }
            upline = users[upline].referrer;
        }
    }

    function claimRewardsFor(address userAddr) public nonReentrant {
        for(uint256 i = 0; i <  tokens.length; i++){
            if(rewards[userAddr][tokens[i]] > 0){
                IERC20(tokens[i]).safeTransfer(userAddr, rewards[userAddr][tokens[i]]);
                rewards[userAddr][tokens[i]] = 0;
            }
        }
    }

    function claimRewards() public {
        claimRewardsFor(msg.sender);
    }

    function commitTransferOwnership(address addr) external onlyAdmin {
        futureAdmin = addr;
        emit CommitOwnership(addr);
    }

    function getTokensList() public view returns (address[] memory){
        return tokens;
    }

    function getDistributionList() public view returns (uint256[] memory){
        return distribution;
    }

    // """
    // @notice Apply ownership transfer
    // """
    function applyTransferOwnership() external onlyAdmin {
        address _admin = futureAdmin;
        require(_admin != address(0), "adminIsZero");
        admin = _admin;
        emit ApplyOwnership(_admin);
    }

    function commitDistribution(uint256[] calldata newDistribution) external onlyAdmin {
        uint256 sum;
        for(uint256 i = 0; i < newDistribution.length; i++){
            sum.add(newDistribution[i]);
        }
        require(sum == 100, '!fullDistribution');
        futureDistribution = newDistribution;
        emit CommitDistribution(futureDistribution);
    }

    // """
    // @notice Apply distribution change
    // """
    function applyDistribution() external onlyAdmin {
        distribution = futureDistribution;
        emit ApplyDistribution(distribution);
    }

    function commitNewToken(address tokenAddress) external onlyAdmin {
        require(tokenAddress != address(0), 'tokenIsZero');
        newToken = tokenAddress;
        emit CommitNewToken(newToken);
    }

    function applyNewToken() external onlyAdmin {
        for(uint256 i = 0; i < tokens.length; i++){
            require(newToken != tokens[i], 'tokenAlreadyExists');
        }
        tokens.push(newToken);
        emit ApplyNewToken(newToken);
    }

}
