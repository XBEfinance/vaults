pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/minting/IMint.sol";

contract SimpleXBEInflation is Initializable {

    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    address public admin;
    address public token;

    uint256 public totalMinted;
    uint256 public targetMinted;
    uint256 public periodicEmission;
    uint256 public startInflationTime;

    uint256 public periodDuration = 86400; // seconds

    mapping(address => uint256) public weights; // in points relative to sumWeight
    uint256 public sumWeight = 0;

    EnumerableSet.AddressSet internal _xbeReceivers;

    event SetAdmin(address admin);

    modifier onlyAdmin {
      require(msg.sender == admin, "!admin");
      _;
    }

    // """
    // @notice Contract constructor
    // @param _name Token full name
    // @param _symbol Token symbol
    // @param _decimals Number of decimals for token
    // @param _targetMinted max amount minted during
    // """
    function configure(
        address _token,
        uint256 _targetMinted,
        uint256 _periodsCount,
        uint256 _periodDuration
    ) external initializer {
        admin = msg.sender;
        token = _token;
        targetMinted = _targetMinted;
        periodicEmission = _targetMinted.div(_periodsCount);
        periodDuration = _periodDuration;
        require(periodDuration > 0, "periodDuration=0");
        startInflationTime = block.timestamp;
    }

    // """
    // @notice Current number of tokens in existence (claimed or unclaimed)
    // """
    function availableSupply() external view returns(uint256) {
        return periodicEmission;
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

    function getWeightInPoints(address _xbeReceiver, uint256 maxPoints) external view returns(uint256) {
        return weights[_xbeReceiver].mul(maxPoints).div(sumWeight);
    }

    function addXBEReceiver(address _xbeReceiver, uint256 _weight) external onlyAdmin {
        _xbeReceivers.add(_xbeReceiver);
        weights[_xbeReceiver] = _weight;
        sumWeight = sumWeight.add(_weight);
    }

    function removeXBEReceiver(address _xbeReceiver) external onlyAdmin {
        sumWeight = sumWeight.sub(weights[_xbeReceiver]);
        _xbeReceivers.remove(_xbeReceiver);
    }

    function setWeight(address _xbeReceiver, uint256 _weight) external onlyAdmin {
        uint256 oldWeight = weights[_xbeReceiver];
        sumWeight = sumWeight.add(_weight).sub(oldWeight);
        weights[_xbeReceiver] = _weight;
    }

    function _getPeriodsPassed() internal view returns(uint256) {
        return block.timestamp.sub(startInflationTime).div(periodDuration);
    }

    // """
    // @notice Mint part of available supply of tokens and assign them to approved contracts
    // @dev Emits a Transfer event originating from 0x00
    // @return bool success
    // """u
    function mintForContracts()
        external
        returns(bool)
    {
        require(totalMinted <= targetMinted, "inflationEnded");
        if (_xbeReceivers.length() > 0) {
            require(sumWeight > 0, "sumWeights=0");
        }

        // distribute prepaid amount for the upfront period
        uint256 periodsToPay = _getPeriodsPassed().add(1);
        // if we missed a payment, the amount will be multiplied

        uint256 plannedToMint = periodsToPay.mul(periodicEmission);
        require(totalMinted < plannedToMint, "availableSupplyDistributed");
        uint256 amountToPay =  plannedToMint.sub(totalMinted);

        for (uint256 i = 0; i < _xbeReceivers.length(); i++) {
            address _to = _xbeReceivers.at(i);
            require(_to != address(0), "!zeroAddress");

            uint256 toMint = amountToPay
              .mul(weights[_to])
              .div(sumWeight);

            IMint(token).mint(_to, toMint);
            totalMinted = totalMinted.add(toMint);
        }
        return true;
    }
}
