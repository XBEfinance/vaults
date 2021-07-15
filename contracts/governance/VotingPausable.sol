/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "@aragon/os/contracts/lib/math/Math.sol";
import "@aragon/minime/contracts/MiniMeToken.sol";

import "./interfaces/IBonusCampaign.sol";
import "./interfaces/IVeXBE.sol";
import "./interfaces/IERC20.sol";

contract VotingStakingRewards {

    bool public paused;
    address private pauser;

    constructor(address _pauser) public {
        pauser = _pauser;
    }

    modifier whenNotPaused {
        require(!paused, "paused");
        _;
    }

    function setPaused(bool _paused) external {
        require(msg.sender == pauser, "!pauser");
        paused = _paused;
    }

}
