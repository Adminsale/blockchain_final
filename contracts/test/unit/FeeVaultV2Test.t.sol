pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../../src/core/FeeVaultV2.sol";
import "../../src/mock/MockUSDC.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract FeeVaultV2Test is Test {
    FeeVaultV2 public vault;
    MockUSDC public asset;

    address public admin = address(0x100);
    address public user = address(0x200);
    address public treasury = address(0x300);

    function setUp() public {
        asset = new MockUSDC();

        vm.startPrank(admin);
        FeeVaultV2 implV1 = new FeeVaultV2();
        ERC1967Proxy proxy = new ERC1967Proxy(address(implV1), abi.encodeWithSignature("initialize(address,address)", address(asset), admin));
        vault = FeeVaultV2(address(proxy));
        vault.initializeV2(100, treasury);
        vm.stopPrank();

        asset.mint(user, 1_000_000e6);
        vm.startPrank(user);
        asset.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function test_InitializeV2() public {
        assertEq(vault.withdrawalFeeBps(), 100);
        assertEq(vault.treasury(), treasury);
    }

    function test_Version() public {
        assertEq(vault.version(), "2.0.0");
    }

    function test_SetWithdrawalFee() public {
        vm.prank(admin);
        vault.setWithdrawalFee(200);
        assertEq(vault.withdrawalFeeBps(), 200);
    }

    function test_SetWithdrawalFeeTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FeeVaultV2.FeeTooHigh.selector));
        vault.setWithdrawalFee(501);
    }

    function test_SetWithdrawalFeeNotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        vault.setWithdrawalFee(200);
    }

    function test_SetTreasury() public {
        vm.prank(admin);
        address newTreasury = address(0x400);
        vault.setTreasury(newTreasury);
        assertEq(vault.treasury(), newTreasury);
    }

    function test_SetTreasuryZero() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FeeVaultV2.ZeroTreasury.selector));
        vault.setTreasury(address(0));
    }

    function test_WithdrawWithFee() public {
        vm.startPrank(user);
        vault.deposit(1000e6, user);
        uint256 shares = vault.balanceOf(user);
        vault.approve(address(vault), shares);
        vault.withdraw(shares, user, user);
        vm.stopPrank();
        assertTrue(asset.balanceOf(treasury) > 0);
    }

    function test_WithdrawWithZeroFee() public {
        vm.prank(admin);
        vault.setWithdrawalFee(0);

        vm.startPrank(user);
        vault.deposit(1000e6, user);
        uint256 shares = vault.balanceOf(user);
        uint256 balanceBefore = asset.balanceOf(user);
        vault.approve(address(vault), shares);
        vault.withdraw(shares, user, user);
        vm.stopPrank();

        assertTrue(asset.balanceOf(user) > balanceBefore);
    }
}
