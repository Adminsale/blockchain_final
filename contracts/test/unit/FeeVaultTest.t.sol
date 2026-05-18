pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../../src/core/FeeVault.sol";
import "../../src/mock/MockUSDC.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract FeeVaultTest is Test {
    FeeVault public vault;
    MockUSDC public asset;
    address public admin = address(0x1);
    address public user = address(0x2);

    function setUp() public {
        asset = new MockUSDC();
        FeeVault impl = new FeeVault();
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeWithSelector(FeeVault.initialize.selector, address(asset), address(this)));
        vault = FeeVault(address(proxy));

        asset.mint(user, 1_000_000e6);
    }

    function test_InitialState() public {
        assertEq(address(vault.asset()), address(asset));
        assertEq(vault.name(), "Prediction Market Fee Vault");
        assertEq(vault.symbol(), "pmFEE");
    }

    function test_Deposit() public {
        vm.startPrank(user);
        asset.approve(address(vault), 1000e6);
        uint256 shares = vault.deposit(1000e6, user);
        vm.stopPrank();

        assertTrue(shares > 0);
        assertEq(vault.balanceOf(user), shares);
        assertEq(vault.totalAssets(), 1000e6);
    }

    function test_DepositBelowMinimum() public {
        vm.startPrank(user);
        asset.approve(address(vault), 5);
        vm.expectRevert(abi.encodeWithSelector(FeeVault.BelowMinimumDeposit.selector));
        vault.deposit(5, user);
        vm.stopPrank();
    }

    function test_DepositExactMinimum() public {
        vm.startPrank(user);
        asset.approve(address(vault), 10);
        uint256 shares = vault.deposit(10, user);
        assertTrue(shares > 0);
        vm.stopPrank();
    }

    function test_Withdraw() public {
        vm.startPrank(user);
        asset.approve(address(vault), 1000e6);
        vault.deposit(1000e6, user);
        uint256 assets = vault.withdraw(100e6, user, user);
        vm.stopPrank();

        assertEq(assets, 100e6);
    }

    function test_DepositFees() public {
        vm.startPrank(user);
        asset.approve(address(vault), 500e6);
        vault.depositFees(500e6);
        vm.stopPrank();

        assertEq(vault.totalFeesCollected(), 500e6);
    }

    function test_Mint() public {
        vm.startPrank(user);
        asset.approve(address(vault), 1000e6);
        uint256 assets = vault.mint(100e6, user);
        vm.stopPrank();

        assertTrue(assets >= 100e6);
    }

    function test_RoundTrip() public {
        vm.startPrank(user);
        asset.approve(address(vault), 100_000e6);
        uint256 shares = vault.deposit(100_000e6, user);
        uint256 assetsBack = vault.redeem(shares, user, user);
        vm.stopPrank();

        assertEq(assetsBack, 100_000e6);
    }

    function test_RoleBasedAccess() public {
        vault.grantRole(vault.UPGRADER_ROLE(), user);
        assertTrue(vault.hasRole(vault.UPGRADER_ROLE(), user));
    }

    function test_OnlyAdminCanGrantRoles() public {
        bytes32 adminRole = vault.DEFAULT_ADMIN_ROLE();
        vm.prank(user);
        vm.expectRevert();
        vault.grantRole(adminRole, user);
    }
}
