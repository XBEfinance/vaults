pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/minting/IMint.sol";
import "./interfaces/IXBEInflation.sol";

contract XBEInflation is Initializable, IXBEInflation {

    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    event Transfer(
        address indexed _from,
        address indexed _to,
        uint256 _value
    );

    event Approval(
        address indexed _owner,
        address indexed _spender,
        uint256 _value
    );

    event UpdateMiningParameters(
        uint256 time,
        uint256 rate,
        uint256 supply
    );
    event SetMinter(address minter);
    event SetAdmin(address admin);

    event CalculatedEpochTimeWritten(uint256 epochTime);

    mapping(int128 => mapping(address => uint256)) private availableEpoch;

    mapping(address => uint256) public _balanceOf;
    mapping(address => mapping(address => uint256)) public _allowances;
    uint256 public _totalSupply;

    address public minter;
    address public admin;

    address public vault;
    address public token;

    uint256 public totalMinted;

    uint256 public constant YEAR = 86400 * 365;
    uint64 public constant PCT_BASE = 10 ** 18;

    uint256 public initialSupply; //= 1303030303;
    uint256 public initialRate; //= 274815283 * 10 ** 18 / YEAR;
    uint256 public rateReductionTime; //= YEAR;
    uint256 public rateReductionCoefficient; //= 1189207115002721024;
    uint256 public rateDenominator; //= 10 ** 18;
    uint256 public inflationDelay; //= 86400;

    int128 public miningEpoch;
    uint256 public startEpochTime;
    uint256 public override rate;

    uint256 public startEpochSupply;

    modifier onlyAdmin {
      require(msg.sender == admin, "!admin");
      _;
    }

    // """
    // @notice Contract constructor
    // @param _name Token full name
    // @param _symbol Token symbol
    // @param _decimals Number of decimals for token
    // """
    function configure(
        address _token,
        address _minter,
        address _bonusCampaign,
        uint256 _initialSupply, // NOT IN WEI!!!
        uint256 _initialRate,
        uint256 _rateReductionTime,
        uint256 _rateReductionCoefficient,
        uint256 _rateDenominator,
        uint256 _inflationDelay
    ) external initializer {
        admin = msg.sender;
        setMinter(_minter);
        bonusCampaign = BonusCampaign(_bonusCampaign);
        token = _token;
        initialSupply = _initialSupply;
        initialRate = _initialRate;
        rateReductionTime = _rateReductionTime;
        rateReductionCoefficient = _rateReductionCoefficient;
        rateDenominator = _rateDenominator;
        inflationDelay = _inflationDelay;
        startEpochTime = block.timestamp.add(inflationDelay).sub(rateReductionTime);
        miningEpoch = -1;
        rate = 0;
        uint256 initSupply = _initialSupply.mul(uint256(10) ** ERC20(_token).decimals());
        startEpochSupply = initSupply;
        totalMinted = initSupply;
    }

    // """
    // @dev Update mining rate and supply at the start of the epoch
    //      Any modifying mining call must also call this
    // """
    function _updateMiningParameters() internal {
        uint256 _rate = rate;
        uint256 _startEpochSupply = startEpochSupply;
        startEpochTime = startEpochTime.add(rateReductionTime);
        miningEpoch += 1;

        if (_rate == 0) {
            _rate = initialRate;
        } else {
            _startEpochSupply = _startEpochSupply.add(_rate.mul(rateReductionTime));
            startEpochSupply = _startEpochSupply;
            _rate = _rate.mul(rateDenominator).div(rateReductionCoefficient);
        }

        rate = _rate;

        emit UpdateMiningParameters(block.timestamp, _rate, _startEpochSupply);
    }

  //   function calculate(uint256 _supply) internal {
  //       uint256 supply = _supply;
  //       for(uint256 i = 0; i < strategy.length;)
  //   }

    // """
    // @notice Update mining rate and supply at the start of the epoch
    // @dev Callable by any address, but only once per epoch
    //      Total supply becomes slightly larger if this function is called late
    // """
    function updateMiningParameters() external {
        require(block.timestamp >= startEpochTime.add(rateReductionTime), "tooSoon");
        _updateMiningParameters();
    }

    // """
    // @notice Get timestamp of the current mining epoch start
    //         while simultaneously updating mining parameters
    // @return Timestamp of the epoch
    // """
    function startEpochTimeWrite() external returns(uint256) {
        uint256 _startEpochTime = startEpochTime;
        if (block.timestamp >= _startEpochTime.add(rateReductionTime)) {
            _updateMiningParameters();
            emit CalculatedEpochTimeWritten(startEpochTime);
            return startEpochTime;
        }
        emit CalculatedEpochTimeWritten(_startEpochTime);
        return _startEpochTime;
    }

    // """
    // @notice Get timestamp of the next mining epoch start
    //         while simultaneously updating mining parameters
    // @return Timestamp of the next epoch
    // """
    function futureEpochTimeWrite() external override returns(uint256) {
        uint256 _startEpochTime = startEpochTime;
        if (block.timestamp >= _startEpochTime.add(rateReductionTime)) {
            _updateMiningParameters();
        }
        _startEpochTime = _startEpochTime.add(rateReductionTime);
        emit CalculatedEpochTimeWritten(_startEpochTime);
        return _startEpochTime;
    }

    function _availableSupply() internal view returns(uint256) {
        return startEpochSupply.add(block.timestamp.sub(startEpochTime).mul(rate));
    }

    // """
    // @notice Current number of tokens in existence (claimed or unclaimed)
    // """
    function availableSupply() external view returns(uint256) {
        return _availableSupply();
    }

    // """
    // @notice How much supply is mintable from start timestamp till end timestamp
    // @param start Start of the time interval (timestamp)
    // @param end End of the time interval (timestamp)
    // @return Tokens mintable from `start` till `end`
    // """
    function mintableInTimeframe(uint256 start, uint256 end) external view returns(uint256) {
        require(start <= end, "startGtEnd");
        uint256 toMint = 0;
        uint256 currentEpochTime = startEpochTime;
        uint256 currentRate = rate;

        // Special case if end is in future (not yet minted) epoch
        if (end > currentEpochTime.add(rateReductionTime)) {
            currentEpochTime = currentEpochTime.add(rateReductionTime);
            currentRate = currentRate.mul(rateDenominator).div(rateReductionCoefficient);
        }

        require(end <= currentEpochTime.add(rateReductionTime), "tooFarInFuture");

        for (uint256 i = 0; i < 999; i++) {
            if (end >= currentEpochTime) {

                uint256 currentEnd = end;

                if (currentEnd > currentEpochTime.add(rateReductionTime)) {
                    currentEnd = currentEpochTime.add(rateReductionTime);
                }

                uint256 currentStart = start;

                if (currentStart >= currentEpochTime.add(rateReductionTime)) {
                    break; // We should never get here but what if...
                } else if (currentStart < currentEpochTime) {
                    currentStart = currentEpochTime;
                }

                toMint = toMint.add(currentRate.mul(currentEnd.sub(currentStart)));

                if (start >= currentEpochTime) {
                    break;
                }
            }
            currentEpochTime = currentEpochTime.sub(rateReductionTime);
            // double-division with rounding made rate a bit less => good
            currentRate = currentRate.mul(rateReductionCoefficient).div(rateDenominator);
            // This should never happen
            require(currentRate <= initialRate, "currentRateGtInitialRate");
        }
        return toMint;
    }

    // """
    // @notice Set the minter address
    // @dev Only callable once, when minter has not yet been set
    // @param _minter Address of the minter
    // """
    function setMinter(address _minter) public onlyAdmin {
        require(minter == address(0), "minterExists");
        minter = _minter;
        emit SetMinter(_minter);
    }

    // """
    // @notice Set the new admin.
    // @dev After all is set up, admin only can change the token name
    // @param _admin New admin address
    // """
    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
        emit SetAdmin(_admin);
    }

    // """
    // @notice Mint `_value` tokens and assign them to `_to`
    // @dev Emits a Transfer event originating from 0x00
    // @param _to The account that will receive the created tokens
    // @param _value The amount that will be created
    // @return bool success
    // """

    mapping(address => uint256) public weights; // in bps
    uint256 public constant SUM_WEIGHT = 10000;

    EnumerableSet.AddressSet internal _xbeReceivers;

    function addXBEReceiver(address _xbeReceiver) external onlyAdmin {
        _xbeReceivers.add(_xbeReceiver);
    }

    function removeXBEReceiver(address _xbeReceiver) external onlyAdmin {
        _xbeReceivers.remove(_xbeReceiver);
    }

    function setWeight(address _xbeReceiver, uint256 _weight) external onlyAdmin {
        weights[_xbeReceiver] = _weight;
        uint256 currentWeightSum = 0;
        for (uint256 i = 0; i < _xbeReceivers.length(); i++) {
            currentWeightSum = currentWeightSum.add(
                weights[_xbeReceivers.at(i)]
            );
        }
        require(currentWeightSum == SUM_WEIGHT, "weightSum!=100%");
    }

    function mintForContracts()
        external
        returns(bool)
    {
        require(_to != address(0), "!zeroAddress");
        uint256 __availableSupply = _availableSupply();
        require(totalMinted < __availableSupply, "availableSupply(Gt|Eq)TotalMinted");
        if (block.timestamp >= startEpochTime.add(rateReductionTime)) {
            _updateMiningParameters();
        }
        for (uint256 i = 0; i < _xbeReceivers.length(); i++) {
            uint256 toMint = __availableSupply
              .mul(
                weights[_xbeReceivers.at(i)]
              )
              .div(SUM_WEIGHT);
            IMint(token).mint(_contract, toMint);
            totalMinted = totalMinted + toMint;
        }
        return true;
    }
}
