pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/ILockSubscriber.sol";

contract LockSubscription is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    EnumerableSet.AddressSet private subscribers;
    address private eventSource;

    modifier onlyEventSource() {
        require(msg.sender == eventSource, '!eventSource');
        _;
    }

    function _setEventSource(address _eventSource) internal {
        require(_eventSource != address(0), 'zeroAddress');
        eventSource = _eventSource;
    }

    function setEventSource(address _eventSource) public onlyOwner {
        _setEventSource(_eventSource);
    }

    function addSubscriber(address s) external onlyOwner {
        require(s != address(0), 'zeroAddress');
        subscribers.add(s);
    }

    function removeSubscriber(address s) external onlyOwner {
        subscribers.remove(s);
    }

    function processLockEvent(
        address account,
        uint256 lockStart,
        uint256 lockEnd,
        uint256 amount
    ) external onlyEventSource
    {
        uint256 count = subscribers.length();
        if (count != 0) {
            for (uint64 i = 0; i < count; i++) {
                ILockSubscriber(subscribers.at(i))
                    .processLockEvent(account, lockStart, lockEnd, amount);
            }
        }
    }
}
