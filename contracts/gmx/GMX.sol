// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../tokens/MintableBaseToken.sol";

contract GMX is MintableBaseToken {
    constructor() MintableBaseToken("GMX", "GMX", 0) {
    }

    function id() external pure returns (string memory _name) {
        return "GMX";
    }
}
