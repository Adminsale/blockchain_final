pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../../src/libraries/Math.sol";

contract MathTest is Test {
    using {PredictionMath.sqrt, PredictionMath.min, PredictionMath.max} for uint256;

    function test_SqrtZero() public {
        assertEq(PredictionMath.sqrt(0), 0);
    }

    function test_SqrtOne() public {
        assertEq(PredictionMath.sqrt(1), 1);
    }

    function test_SqrtFour() public {
        assertEq(PredictionMath.sqrt(4), 2);
    }

    function test_SqrtLarge() public {
        uint256 result = PredictionMath.sqrt(1e18);
        assertEq(result, 1e9);
    }

    function test_SqrtMaxUint() public {
        uint256 result = PredictionMath.sqrt(type(uint256).max);
        assertEq(result, 340282366920938463463374607431768211455);
    }

    function test_Min() public {
        assertEq(PredictionMath.min(5, 10), 5);
        assertEq(PredictionMath.min(10, 5), 5);
        assertEq(PredictionMath.min(7, 7), 7);
    }

    function test_Max() public {
        assertEq(PredictionMath.max(5, 10), 10);
        assertEq(PredictionMath.max(10, 5), 10);
        assertEq(PredictionMath.max(7, 7), 7);
    }
}
