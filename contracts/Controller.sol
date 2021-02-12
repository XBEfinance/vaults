pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/IController.sol";
import "./governance/Governable.sol";
import "./templates/Initializable.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/IOneSplitAudit.sol";


contract Controller is IController, Governable, Initializable {

    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // token => vault
    mapping(address => address) private _vaults;

    // token => strategy
    mapping(address => address) private _strategies;

    // from => to => converter address
    mapping(address => mapping(address => address)) public converters;

    // token => strategy => is strategy approved
    mapping(address => mapping(address => bool)) private _approvedStrategies;

    address public strategist;

    //Treasury contract
    address private _treasury;
    address private _oneSplit;

    // procents (in base points) to send to treasury
    uint256 public split = 5000;

    // hundred procents (in base points)
    uint256 public constant max = 10000;

    // One Split parts
    uint256 public parts;

    modifier onlyGovernanceOrStrategist {
      require(_msgSender() == strategist || _msgSender() == governance, "!governance|strategist");
      _;
    }

    constructor() Initializable() public {}

    function configure(
          address _initialTreasury,
          address _initialStrategist
    ) external initializer {
        _treasury = _initialTreasury;
        strategist = _initialStrategist;
    }

    function inCaseTokensGetStuck(address _token, uint256 _amount) onlyGovernanceOrStrategist external {
        IERC20(_token).safeTransfer(_msgSender(), _amount);
    }

    function inCaseStrategyTokenGetStuck(address _strategy, address _token) onlyGovernanceOrStrategist external {
        IStrategy(_strategy).withdraw(_token);
    }

    function withdraw(address _token, uint256 _amount) override external {
      IStrategy(_strategies[_token]).withdraw(_amount);
    }

    function setParts(uint256 _newParts) onlyGovernance external {
        require(parts != _newParts, "!old");
        parts = _newParts;
    }

    function setRewards(address _newTreasury) onlyGovernance external {
        require(_treasury != _newTreasury, 'old');
        _treasury = _newTreasury;
    }

    function setOneSplit(address _newOneSplit) onlyGovernance external {
        require(_oneSplit != _newOneSplit, 'old');
        _oneSplit = _newOneSplit;
    }

    function setStrategist(address _newStrategist) onlyGovernance external {
        require(strategist != _newStrategist, 'old');
        strategist = _newStrategist;
    }

    function rewards() override external view returns(address) {
        return _treasury;
    }

    function vaults(address _token) override external view returns(address) {
        return _vaults[_token];
    }

    function strategies(address _token) override external view returns(address) {
        return _strategies[_token];
    }

    function setVault(address _token, address _vault)
        override
        onlyGovernanceOrStrategist
        external
    {
        require(_vaults[_token] == address(0), "!vault 0");
        _vaults[_token] = _vault;
    }

    function setConverter(
        address _input,
        address _output,
        address _converter
    ) onlyGovernanceOrStrategist external {
        converters[_input][_output] = _converter;
    }

    function setStrategy(address _token, address _strategy) override onlyGovernanceOrStrategist external {
        require(_approvedStrategies[_token][_strategy], "!approved");
        address _current = _strategies[_token];
        if (_current != address(0)) {
            IStrategy(_current).withdrawAll();
        }
        _strategies[_token] = _strategy;
    }

    function setApproveStrategy(address _token, address _strategy, bool _status) onlyGovernance external {
        _approvedStrategies[_token][_strategy] = _status;
    }

    function approvedStrategies(address _token, address _strategy) override external view returns(bool) {
        return _approvedStrategies[_token][_strategy];
    }

    function earn(address _token, uint256 _amount) override public {
        address _strategy = _strategies[_token];
        address _want = IStrategy(_strategy).want();
        if (_want != _token) {
            address converter = converters[_token][_want];
            require(converter != address(0), '!converter');
            IERC20(_token).safeTransfer(converter, _amount);
            _amount = IConverter(converter).convert(_strategy);
            IERC20(_want).safeTransfer(_strategy, _amount);
        } else {
            IERC20(_token).safeTransfer(_strategy, _amount);
        }
        IStrategy(_strategy).deposit();
    }

    // Only allows to withdraw non-core strategy tokens ~ this is over and above normal yield
    function harvest(address _strategy, address _token) override external {
        require(_token != _want, "!want");
        // This contract should never have value in it, but just incase since this is a public call
        uint256 _before = IERC20(_token).balanceOf(address(this));
        IStrategy(_strategy).withdraw(_token);
        uint256 _after =  IERC20(_token).balanceOf(address(this));
        if (_after > _before) {
            uint256 _amount = _after.sub(_before);
            address _want = IStrategy(_strategy).want();
            uint256[] memory _distribution;
            uint256 _expected;
            _before = IERC20(_want).balanceOf(address(this));
            IERC20(_token).safeApprove(_oneSplit, 0);
            IERC20(_token).safeApprove(_oneSplit, _amount);
            (_expected, _distribution) = IOneSplitAudit(_oneSplit).getExpectedReturn(_token, _want, _amount, parts, 0);
            IOneSplitAudit(_oneSplit).swap(_token, _want, _amount, _expected, _distribution, 0);
            _after = IERC20(_want).balanceOf(address(this));
            if (_after > _before) {
                _amount = _after.sub(_before);
                uint256 _reward = _amount.mul(split).div(max);
                earn(_want, _amount.sub(_reward));
                IERC20(_want).safeTransfer(_treasury, _reward);
            }
        }
    }
}
