pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../../src/libraries/SafeTransferLib.sol";
import "../../src/mock/MockUSDC.sol";

contract MockTokenNoReturn {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function transfer(address to, uint256 value) external {
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
    }

    function transferFrom(address from, address to, uint256 value) external {
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
    }

    function approve(address spender, uint256 value) external {
        allowance[msg.sender][spender] = value;
    }
}

contract MockTokenReverts {
    function transfer(address, uint256) external pure returns (bool) { return false; }
    function transferFrom(address, address, uint256) external pure returns (bool) { return false; }
    function approve(address, uint256) external pure returns (bool) { return false; }
}

contract MockTokenEmptyReturn {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function transfer(address to, uint256 value) external { }
    function transferFrom(address from, address to, uint256 value) external { }
    function approve(address spender, uint256 value) external { }
}

contract SafeTransferWrapper {
    using SafeTransferLib for address;

    function callTransfer(address t, address to, uint256 val) external {
        t.safeTransfer(to, val);
    }

    function callTransferFrom(address t, address from, address to, uint256 val) external {
        t.safeTransferFrom(from, to, val);
    }

    function callApprove(address t, address spender, uint256 val) external {
        t.safeApprove(spender, val);
    }
}

contract SafeTransferLibTest is Test {
    using SafeTransferLib for address;

    SafeTransferWrapper public wrapper;

    MockUSDC public token;
    MockTokenNoReturn public tokenNoReturn;
    MockTokenReverts public tokenReverts;

    address public recipient = address(0x200);

    function setUp() public {
        wrapper = new SafeTransferWrapper();

        token = new MockUSDC();
        token.mint(address(this), 1000e6);

        tokenNoReturn = new MockTokenNoReturn();
        tokenNoReturn.mint(address(this), 1000);

        tokenReverts = new MockTokenReverts();
    }

    function test_SafeTransfer_USDC() public {
        address(token).safeTransfer(recipient, 100e6);
        assertEq(token.balanceOf(recipient), 100e6);
    }

    function test_SafeTransferFrom_USDC() public {
        token.approve(address(this), 200e6);
        address(token).safeTransferFrom(address(this), recipient, 200e6);
        assertEq(token.balanceOf(recipient), 200e6);
    }

    function test_SafeApprove_USDC() public {
        address spender = address(0x300);
        address(token).safeApprove(spender, 500e6);
        assertEq(token.allowance(address(this), spender), 500e6);
    }

    function test_SafeTransfer_TokenNoReturn() public {
        address(tokenNoReturn).safeTransfer(recipient, 100);
        assertEq(tokenNoReturn.balanceOf(recipient), 100);
    }

    function test_SafeTransferFrom_TokenNoReturn() public {
        tokenNoReturn.approve(address(this), 200);
        address(tokenNoReturn).safeTransferFrom(address(this), recipient, 200);
        assertEq(tokenNoReturn.balanceOf(recipient), 200);
    }

    function test_SafeApprove_TokenNoReturn() public {
        address spender = address(0x300);
        address(tokenNoReturn).safeApprove(spender, 500);
        assertEq(tokenNoReturn.allowance(address(this), spender), 500);
    }

    function test_SafeTransfer_RevertOnFalse() public {
        vm.expectRevert();
        wrapper.callTransfer(address(tokenReverts), recipient, 100);
    }

    function test_SafeTransferFrom_RevertOnFalse() public {
        vm.expectRevert();
        wrapper.callTransferFrom(address(tokenReverts), address(this), recipient, 100);
    }

    function test_SafeApprove_RevertOnFalse() public {
        vm.expectRevert();
        wrapper.callApprove(address(tokenReverts), recipient, 100);
    }

    function test_SafeTransfer_EmptyReturn() public {
        MockTokenEmptyReturn emptyToken = new MockTokenEmptyReturn();
        emptyToken.mint(address(this), 100);
        address(emptyToken).safeTransfer(recipient, 50);
    }

    function test_SafeTransferFrom_EmptyReturn() public {
        MockTokenEmptyReturn emptyToken = new MockTokenEmptyReturn();
        emptyToken.mint(address(this), 100);
        emptyToken.approve(address(this), 50);
        address(emptyToken).safeTransferFrom(address(this), recipient, 50);
    }

    function test_SafeApprove_EmptyReturn() public {
        MockTokenEmptyReturn emptyToken = new MockTokenEmptyReturn();
        address(emptyToken).safeApprove(recipient, 100);
    }
}
