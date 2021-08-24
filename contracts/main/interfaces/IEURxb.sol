pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEURxb is IERC20 {
    function mint(address account, uint256 value) external;

    function burn(address account, uint256 value) external;

    function addNewMaturity(uint256 amount, uint256 maturityEnd) external;

    function removeMaturity(uint256 amount, uint256 maturityEnd) external;

    function expIndex() external view returns (uint256);

    function accrueInterest() external;
}
