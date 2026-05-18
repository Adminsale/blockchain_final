pragma solidity ^0.8.23;

import "./FeeVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FeeVaultV2 is FeeVault {
    using SafeERC20 for IERC20;

    uint256 public withdrawalFeeBps;
    uint256 public constant MAX_WITHDRAWAL_FEE = 500;
    address public treasury;

    event WithdrawalFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    error FeeTooHigh();
    error ZeroTreasury();

    function initializeV2(uint256 _withdrawalFeeBps, address _treasury) external reinitializer(2) {
        if (_withdrawalFeeBps > MAX_WITHDRAWAL_FEE) revert FeeTooHigh();
        if (_treasury == address(0)) revert ZeroTreasury();
        withdrawalFeeBps = _withdrawalFeeBps;
        treasury = _treasury;
    }

    function setWithdrawalFee(uint256 _feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_feeBps > MAX_WITHDRAWAL_FEE) revert FeeTooHigh();
        emit WithdrawalFeeUpdated(withdrawalFeeBps, _feeBps);
        withdrawalFeeBps = _feeBps;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert ZeroTreasury();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public override returns (uint256)
    {
        if (withdrawalFeeBps > 0) {
            uint256 fee = (assets * withdrawalFeeBps) / 10000;
            super.withdraw(assets, address(this), owner);
            IERC20(asset()).safeTransfer(receiver, assets - fee);
            IERC20(asset()).safeTransfer(treasury, fee);
            emit FeesWithdrawn(fee);
            return convertToShares(assets);
        }
        return super.withdraw(assets, receiver, owner);
    }

    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
