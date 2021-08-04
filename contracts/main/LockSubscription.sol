pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "../interfaces/ILockSubscriber.sol";

contract LockSubscription is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    EnumerableSet.AddressSet private subscribers;

    function addSubscriber(address s) onlyOwner {
        subscribers.add(s);
    }

    function removeSubscriber(address s) onlyOwner {
        subscribers.remove(s);
    }

    function processLockEvent(
        address account,
        uint256 lockStart,
        uint256 lockEnd,
        uint256 amount
    ) internal
    {
        uint256 count = subscribers.length;
        if (count == 0) {
            return;
        }
        for (uint64 i = 0; i < count; i++) {
            ILockSubscriber(subscribers[i])
                .processLockEvent(account, lockStart, lockEnd, amount);
        }
    }
}
