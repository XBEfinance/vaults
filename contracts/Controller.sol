pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./interfaces/IController.sol";
import "./governance/Governable.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/IOneSplitAudit.sol";

/// @title Controller
/// @notice The contract is the middleman between vault and strategy, it balances and trigger earn processes
contract Controller is IController, Governable, Initializable, Context {

    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Emits when funds are withdrawn fully from related to vault strategy
    /// @param _token Token address to be withdrawn
    event WithdrawToVaultAll(address _token);

    event Earn(address _token, uint256 _amount);
    event Harvest(address _strategy, address _token);

    /// @dev token => vault
    mapping(address => address) private _vaults;

    /// @dev token => strategy
    mapping(address => address) private _strategies;

    /// @dev from => to => converter address
    mapping(address => mapping(address => address)) private _converters;

    /// @dev token => strategy => is strategy approved
    mapping(address => mapping(address => bool)) private _approvedStrategies;

    /// @notice Strategist is an actor who created the strategies and he is receiving fees from strategies execution
    address public strategist;

    /// @notice 1Inch aggregator address that used in conversion of the profit from strategies
    address public oneSplit;

    /// @notice Treasury contract address (used to channel fees to governance and rewards for voting process and investors)
    address private _treasury;

    /// @notice procents (in base points) to send to treasury
    uint256 public split = 5000;

    /// @notice Utility constant, 100% (in base points)
    uint256 public constant max = 10000;

    /// @notice 1Inch parts parameter for swaps
    uint256 public parts = 100;

    /// @dev Prevents other msg.sender than either governance or strategist addresses
    modifier onlyGovernanceOrStrategist {
      require(_msgSender() == strategist || _msgSender() == governance, "!governance|strategist");
      _;
    }

    /// @notice Default initialize method for solving migration linearization problem
    /// @dev Called once only by deployer
    /// @param _initialTreasury treasury contract address
    /// @param _initialStrategist strategist address
    function configure(
          address _initialTreasury,
          address _initialStrategist
    ) external initializer {
        _treasury = _initialTreasury;
        strategist = _initialStrategist;
    }

    /// @notice Used only to rescue stuck funds from controller to msg.sender
    /// @param _token Token to rescue
    /// @param _amount Amount tokens to rescue
    function inCaseTokensGetStuck(address _token, uint256 _amount) onlyGovernanceOrStrategist external {
        IERC20(_token).safeTransfer(_msgSender(), _amount);
    }

    /// @notice Used only to rescue stuck or unrelated funds from strategy to vault
    /// @param _strategy Strategy address
    /// @param _token Unrelated token address
    function inCaseStrategyTokenGetStuck(address _strategy, address _token) onlyGovernanceOrStrategist external {
        IStrategy(_strategy).withdraw(_token);
    }

    /// @notice Withdraws funds from strategy to related vault
    /// @param _token Token address to withdraw
    /// @param _amount Amount tokens
    function withdraw(address _token, uint256 _amount) override external {
        IStrategy(_strategies[_token]).withdraw(_amount);
    }

    /// @notice Usual setter with check if param is new
    /// @param _newParts New value
    function setParts(uint256 _newParts) onlyGovernance external {
        require(parts != _newParts, "!old");
        parts = _newParts;
    }

    /// @notice Usual setter with additional checks
    /// @param _newTreasury New value
    function setRewards(address _newTreasury) onlyGovernance external {
        require(_treasury != _newTreasury, '!old');
        require(_newTreasury != address(0), '!treasury');
        require(_newTreasury.isContract(), '!contract');
        _treasury = _newTreasury;
    }

    /// @notice Usual setter with check if param is new
    /// @param _newOneSplit New value
    function setOneSplit(address _newOneSplit) onlyGovernance external {
        require(oneSplit != _newOneSplit, '!old');
        oneSplit = _newOneSplit;
    }

    /// @notice Usual setter with check if param is new
    /// @param _newStrategist New value
    function setStrategist(address _newStrategist) onlyGovernance external {
        require(strategist != _newStrategist, '!old');
        strategist = _newStrategist;
    }

    /// @notice Used to obtain fees receivers address
    /// @return Treasury contract address
    function rewards() override external view returns(address) {
        return _treasury;
    }

    /// @notice Getter for vaults mapping
    /// @return Corresponding to token vault address
    function vaults(address _token) override external view returns(address) {
        return _vaults[_token];
    }

    /// @notice Getter for strategies mapping
    /// @return Corresponding to token strategy address
    function strategies(address _token) override external view returns(address) {
        return _strategies[_token];
    }

    /// @notice Getter for converters mapping
    /// @return Corresponding to given path converter
    function converters(address _fromToken, address _toToken) override external view returns(address) {
        return _converters[_fromToken][_toToken];
    }

    /// @notice Usual setter of vault in mapping with check if new vault is not address(0)
    /// @param _token Business logic token of the vault
    /// @param _vault Vault address
    function setVault(address _token, address _vault)
        override
        onlyGovernanceOrStrategist
        external
    {
        require(_vaults[_token] == address(0), "!vault 0");
        _vaults[_token] = _vault;
    }

    /// @notice Usual setter of converter contract, it implements the optimal logic to token conversion
    /// @param _input Input token address
    /// @param _output Output token address
    /// @param _converter Converter contract
    function setConverter(
        address _input,
        address _output,
        address _converter
    ) onlyGovernanceOrStrategist external {
        _converters[_input][_output] = _converter;
    }

    /// @notice Sets new link between business logic token and strategy, and if strategy is already used, withdraws all funds from it to the vault
    /// @param _token Business logic token address
    /// @param _strategy Corresponded strategy contract address
    function setStrategy(address _token, address _strategy) override onlyGovernanceOrStrategist external {
        require(_approvedStrategies[_token][_strategy], "!approved");
        address _current = _strategies[_token];
        if (_current != address(0)) {
            IStrategy(_current).withdrawAll();
            emit WithdrawToVaultAll(_token);
        }
        _strategies[_token] = _strategy;
    }


    /// @notice Approves strategy to be added to mapping, needs to be done before setting strategy
    /// @param _token Business logic token address
    /// @param _strategy Strategy contract address
    /// @param _status Approved or not (bool)?
    function setApprovedStrategy(address _token, address _strategy, bool _status) onlyGovernance external {
        _approvedStrategies[_token][_strategy] = _status;
    }

    /// @notice Get approval status for strategy that corresponds to business logic token
    /// @param _token Business logic token address
    /// @param _strategy Strategy contract address
    /// @return Boolean status true - approved, false - not approved
    function approvedStrategies(address _token, address _strategy) override external view returns(bool) {
        return _approvedStrategies[_token][_strategy];
    }

    /// @notice The method converts if needed given token to business logic strategy token,
    /// transfers converted tokens to strategy, and executes the business logic
    /// @param _token Given token address
    /// @param _amount Amount of given token address
    function earn(address _token, uint256 _amount) override public {
        address _strategy = _strategies[_token];
        address _want = IStrategy(_strategy).want();
        if (_want != _token) {
            address converter = _converters[_token][_want];
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

    /// @notice The method withdraws full balance of the strategy, cuts the profit if any exist,
    /// chops and channels it to treasury and reinvest the rest
    /// @param _strategy Strategy to action
    /// @param _token Token that we want to chop and reinvest (could be any, becuaise 1inch used for conversion)
    /// @dev Only allows to withdraw non-core strategy tokens ~ this is over and above normal yield
    function harvest(address _strategy, address _token) override onlyGovernanceOrStrategist external {
        address _want = IStrategy(_strategy).want();
        require(_token != _want, "!want");
        // This contract should never have value in it, but just incase since this is a public call
        uint256 _before = IERC20(_token).balanceOf(address(this));
        IStrategy(_strategy).withdraw(_token);
        uint256 _after =  IERC20(_token).balanceOf(address(this));
        if (_after > _before) {
            uint256 _amount = _after.sub(_before);
            uint256[] memory _distribution;
            uint256 _expected;
            _before = IERC20(_want).balanceOf(address(this));
            IERC20(_token).safeApprove(oneSplit, 0);
            IERC20(_token).safeApprove(oneSplit, _amount);
            (_expected, _distribution) = IOneSplitAudit(oneSplit).getExpectedReturn(
                _token,
                _want,
                _amount,
                parts,
                0
            );
            _after = IOneSplitAudit(oneSplit).swap(
                _token,
                _want,
                _amount,
                _expected,
                _distribution,
                0
            );
            if (_after > _before) {
                _amount = _after.sub(_before);
                uint256 _reward = _amount.mul(split).div(max);
                earn(_want, _amount.sub(_reward));
                require(IERC20(_want).transfer(_treasury, _reward), '!transferTreasury');
                emit Harvest(_strategy, _token);
            }
        }
    }
}
