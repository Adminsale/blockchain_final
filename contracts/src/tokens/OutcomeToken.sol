pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract OutcomeToken is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    string public name;
    string public symbol;

    mapping(uint256 => uint256) public totalSupply;

    constructor(string memory _name, string memory _symbol, string memory _uri) ERC1155(_uri) {
        name = _name;
        symbol = _symbol;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setURI(string memory newUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newUri);
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data) external onlyRole(MINTER_ROLE) {
        totalSupply[id] += amount;
        _mint(account, id, amount, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external onlyRole(MINTER_ROLE) {
        for (uint256 i = 0; i < ids.length; i++) {
            totalSupply[ids[i]] += amounts[i];
        }
        _mintBatch(to, ids, amounts, data);
    }

    function burn(address account, uint256 id, uint256 amount) external onlyRole(BURNER_ROLE) {
        totalSupply[id] -= amount;
        _burn(account, id, amount);
    }

    function burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) external onlyRole(BURNER_ROLE) {
        for (uint256 i = 0; i < ids.length; i++) {
            totalSupply[ids[i]] -= amounts[i];
        }
        _burnBatch(account, ids, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
