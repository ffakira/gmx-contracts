// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FaucetToken is ERC20 {
    uint256 public DROPLET_INTERVAL = 8 hours;

    address public gov;
    uint256 public dropletAmount;
    bool public isFaucetEnabled;

    mapping(address => uint256) public claimedAt;

    uint8 private decimals_;

    /**
     * @dev Sets the values for {name} and {symbol}, initializes {decimals} with
     * a default value of 18.
     *
     * To select a different value for {decimals}, use {_setupDecimals}.
     *
     * All three of these values are immutable: they can only be set once during
     * construction.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _dropletAmount
    ) ERC20(_name, _symbol) {
        decimals_ = _decimals;
        gov = msg.sender;
        dropletAmount = _dropletAmount;
    }

    function mint(address account, uint256 amount) public {
        require(msg.sender == gov, "FaucetToken: forbidden");
        _mint(account, amount);
    }

    function enableFaucet() public {
        require(msg.sender == gov, "FaucetToken: forbidden");
        isFaucetEnabled = true;
    }

    function disableFaucet() public {
        require(msg.sender == gov, "FaucetToken: forbidden");
        isFaucetEnabled = false;
    }

    function setDropletAmount(uint256 _dropletAmount) public {
        require(msg.sender == gov, "FaucetToken: forbidden");
        dropletAmount = _dropletAmount;
    }

    function claimDroplet() public {
        require(isFaucetEnabled, "FaucetToken: faucet not enabled");
        require(claimedAt[msg.sender] + DROPLET_INTERVAL <= block.timestamp, "FaucetToken: droplet not available yet");
        claimedAt[msg.sender] = block.timestamp;
        _mint(msg.sender, dropletAmount);
    }

    function decimals() public view virtual override returns (uint8) {
        return decimals_;
    }
}
