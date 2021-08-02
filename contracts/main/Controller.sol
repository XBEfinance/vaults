pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./interfaces/IController.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/IOneSplitAudit.sol";


/// @title Controller
/// @notice The contract is the middleman between vault and strategy, it balances and trigger earn processes
contract Controller is IController, Ownable, Initializable {
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Emits when funds are withdrawn fully from related to vault strategy
    /// @param _token Token address to be withdrawn
    event WithdrawToVaultAll(address _token);

    event Earn(address _token, uint256 _amount);
    event Harvest(address _strategy, address _token);

    /// @dev token => vault
    mapping(address => address) public override vaults;

    /// @dev token => strategy
    mapping(address => address) public override strategies;

    /// @dev from => to => converter address
    mapping(address => mapping(address => address)) public override converters;

    /// @dev token => strategy => is strategy approved
    mapping(address => mapping(address => bool)) public override approvedStrategies;

    /// @notice Strategist is an actor who created the strategies and he is receiving fees from strategies execution
    address public strategist;

    /// @notice 1Inch aggregator address that used in conversion of the profit from strategies
    address public oneSplit;

    /// @notice Treasury contract address (used to channel fees to governance and rewards for voting process and investors)
    address private _treasury;

    /// @notice procents (in base points) to send to treasury
    uint256 public split = 0;

    /// @notice Utility constant, 100% (in base points)
    uint256 public constant max = 10000;

    /// @notice 1Inch parts parameter for swaps
    uint256 public parts = 100;

    /// @dev Prevents other msg.sender than either governance or strategist addresses
    modifier onlyOwnerOrStrategist {
      require(_msgSender() == strategist || _msgSender() == owner(), "!governance|strategist");
      _;
    }

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _initialTreasury treasury contract address
    /// @param _initialStrategist strategist address
    function configure(
          address _initialTreasury,
          address _initialStrategist,
          address _governance
    ) external initializer {
        _treasury = _initialTreasury;
        strategist = _initialStrategist;
        transferOwnership(_governance);
    }

    /// @notice Used only to rescue stuck funds from controller to msg.sender
    /// @param _token Token to rescue
    /// @param _amount Amount tokens to rescue
    function inCaseTokensGetStuck(address _token, uint256 _amount) onlyOwnerOrStrategist external {
        IERC20(_token).transfer(_msgSender(), _amount);
    }

    /// @notice Used only to rescue stuck or unrelated funds from strategy to vault
    /// @param _strategy Strategy address
    /// @param _token Unrelated token address
    function inCaseStrategyTokenGetStuck(address _strategy, address _token) onlyOwnerOrStrategist external {
        IStrategy(_strategy).withdraw(_token);
    }

    /// @notice Withdraws funds from strategy to related vault
    /// @param _token Token address to withdraw
    /// @param _amount Amount tokens
    function withdraw(address _token, uint256 _amount) override external {
        IStrategy(strategies[_token]).withdraw(_amount);
    }

    function claim(
        address _wantToken,
        address _tokenToClaim
    ) override external {
        IStrategy(strategies[_wantToken]).claim(_tokenToClaim);
    }

    /// @notice forces the strategy to take away the rewards due to it
    // this method must call via backend
    /// @param _strategy strategy address
    function getRewardStrategy(address _strategy) external override {
        IStrategy(_strategy).getRewards();
    }

    /// @notice Usual setter with check if param is new
    /// @param _newParts New value
    function setParts(uint256 _newParts) onlyOwner external {
        require(parts != _newParts, "!old");
        parts = _newParts;
    }

    /// @notice Usual setter with check if param is new
    /// @param _newSplit New value
    function setSplit(uint256 _newSplit) onlyOwner external {
        require(split != _newSplit && _newSplit < max, "!old|>max");
        split = _newSplit;
    }

    /// @notice Usual setter with additional checks
    /// @param _newTreasury New value
    function setRewards(address _newTreasury) onlyOwner external {
        require(_treasury != _newTreasury, '!old');
        require(_newTreasury != address(0), '!treasury');
        require(_newTreasury.isContract(), '!contract');
        _treasury = _newTreasury;
    }

    /// @notice Usual setter with check if param is new
    /// @param _newOneSplit New value
    function setOneSplit(address _newOneSplit) onlyOwner external {
        require(oneSplit != _newOneSplit, '!old');
        oneSplit = _newOneSplit;
    }

    /// @notice Usual setter with check if param is new
    /// @param _newStrategist New value
    function setStrategist(address _newStrategist) onlyOwner external {
        require(strategist != _newStrategist, '!old');
        strategist = _newStrategist;
    }

    /// @notice Used to obtain fees receivers address
    /// @return Treasury contract address
    function rewards() override external view returns(address) {
        return _treasury;
    }

    /// @notice Usual setter of vault in mapping with check if new vault is not address(0)
    /// @param _token Business logic token of the vault
    /// @param _vault Vault address
    function setVault(address _token, address _vault)
        override
        onlyOwnerOrStrategist
        external
    {
        require(vaults[_token] == address(0), "!vault 0");
        vaults[_token] = _vault;
    }

    /// @notice Usual setter of converter contract, it implements the optimal logic to token conversion
    /// @param _input Input token address
    /// @param _output Output token address
    /// @param _converter Converter contract
    function setConverter(
        address _input,
        address _output,
        address _converter
    ) onlyOwnerOrStrategist external {
        converters[_input][_output] = _converter;
    }

    /// @notice Sets new link between business logic token and strategy, and if strategy is already used, withdraws all funds from it to the vault
    /// @param _token Business logic token address
    /// @param _strategy Corresponded strategy contract address
    function setStrategy(address _token, address _strategy) override onlyOwnerOrStrategist external {
        require(approvedStrategies[_token][_strategy], "!approved");
        address _current = strategies[_token];
        if (_current != address(0)) {
            IStrategy(_current).withdrawAll();
            emit WithdrawToVaultAll(_token);
        }
        strategies[_token] = _strategy;
    }


    /// @notice Approves strategy to be added to mapping, needs to be done before setting strategy
    /// @param _token Business logic token address
    /// @param _strategy Strategy contract address
    /// @param _status Approved or not (bool)?
    function setApprovedStrategy(address _token, address _strategy, bool _status) onlyOwner external {
        approvedStrategies[_token][_strategy] = _status;
    }

    /// @notice The method converts if needed given token to business logic strategy token,
    /// transfers converted tokens to strategy, and executes the business logic
    /// @param _token Given token address (wERC20)
    /// @param _amount Amount of given token address
    function earn(address _token, uint256 _amount) override public {
        address _strategy = strategies[_token];
        address _want = IStrategy(_strategy).want();
        if (_want != _token) {
            address converter = converters[_token][_want];
            require(converter != address(0), '!converter');
            require(IERC20(_token).transfer(converter, _amount), "!transferConverterToken");
            _amount = IConverter(converter).convert(_strategy);
            require(IERC20(_want).transfer(_strategy, _amount), "!transferStrategyWant");
        } else {
            require(IERC20(_token).transfer(_strategy, _amount), "!transferStrategyToken");
        }
        IStrategy(_strategy).deposit();
        emit Earn(_token, _amount);
    }
}
