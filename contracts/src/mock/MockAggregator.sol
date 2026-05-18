pragma solidity ^0.8.23;

contract MockAggregator {
    int256 public answer;
    uint256 public updatedAt;

    constructor(int256 _answer) {
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }

    function setAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function decimals() external pure returns (uint8) { return 8; }

    function setRoundData(uint80 _roundId, uint80 _answeredInRound) external {
        // For testing round completeness
    }
}
