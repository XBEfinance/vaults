pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "./interfaces/IController.sol";
import "./governance/Governable.sol";
import "./templates/Initializable.sol";


contract Controller is IController, Governable, Initializable, Context {

    using Address for address;
    using SafeMath for uint256;

    // token => vault
    mapping(address => address) public vaults;

    // token => strategy
    mapping(address => address) public strategies;

    // from => to => converter address
    mapping(address => mapping(address => address)) public converters;

    // token => strategy => is strategy approved
    mapping(address => mapping(address => bool)) private _approvedStrategies;

    address public strategist;

    //Treasury contract
    address public rewards;


    modifier onlyGovernanceOrStrategist {
      require(_msgSender() == strategist || _msgSender() == governance(), "!governance|strategist");
      _;
    }

    function configure(
          address _eurxbToken,
          address _initialVault,
          address _initialStrategy,
          address _initialRewards,
          address _initialStrategist
    ) external initializer {
        vaults[_eurxbToken] = _initialVault;
        strategies[_eurxbToken] = _initialStrategy;
        rewards = _initialRewards;
        strategist = _initialStrategist;
    }

    function inCaseTokensGetStuck(address _token, uint256 _amount) onlyGovernanceOrStrategist external {
        IERC20(_token).safeTransfer(_msgSender(), _amount);
    }

    function inCaseStrategyTokenGetStuck(address _strategy, address _token) onlyGovernanceOrStrategist external {
        IStrategy(_strategy).withdraw(_token);
    }

    function setRewards(address _newRewards) onlyGovernance external {
        require(rewards != _newRewards, 'old');
        rewards = _newRewards;
    }

    function setStrategist(address _newStrategist) onlyGovernance external {
        require(strategist != _newStrategist, 'old');
        strategist = _newStrategist;
    }

    function earn(address _token, uint256 _amount) override external {
        address _strategy = findStrategyOfToken(_token);
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

    function rewards() override external view returns(address) {
        return _rewards;
    }

    function vaults(address _token) override external view returns(address) {
        return vaults[_token];
    }

    function strategies(address _token) override external view returns(address) {
        return strategies[_token];
    }

    function setVault(address _token, address _vault) 
        override
        onlyGovernanceOrStrategist
        external
    {
        require(vaults[_token] == address(0), "!vault 0");
        vaults[_token] = _vault;
    }

    function setConverter(
        address _input,
        address _output,
        address _converter
    ) onlyGovernanceOrStrategist external {
        converters[_input][_output] = _converter;
    }

    function setStrategy(address _token, address _strategy) onlyGovernanceOrStrategist external {
        require(approvedStrategies[_token][_strategy], "!approved");
        address _current = strategies[_token];
        if (_current != address(0)) {
            IStrategy(_current).withdrawAll();
        }
        strategies[_token] = _strategy;
    }

    function setApproveStrategy(address _token, address _strategy, bool _status) onlyGovernance external {
        _approvedStrategies[_token][_strategy] = _status;
    }

    function approvedStrategies(address _token, address _strategy) override external view returns(bool) {
        return _approvedStrategies[_token][_strategy];
    }
}
