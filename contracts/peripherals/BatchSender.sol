// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../access/Governable.sol";

contract BatchSender is Governable {

    mapping (address => bool) public isHandler;

    event BatchSend(
        uint256 indexed typeId,
        address indexed token,
        address[] accounts,
        uint256[] amounts
    );

    modifier onlyHandler() {
        require(isHandler[msg.sender], "BatchSender: forbidden");
        _;
    }

    constructor() {
        isHandler[msg.sender] = true;
    }

    function setHandler(address _handler, bool _isActive) external onlyGov {
        isHandler[_handler] = _isActive;
    }

    function send(IERC20 _token, address[] memory _accounts, uint256[] memory _amounts) public onlyHandler {
        _send(_token, _accounts, _amounts, 0);
    }

    function sendAndEmit(IERC20 _token, address[] memory _accounts, uint256[] memory _amounts, uint256 _typeId) public onlyHandler {
        _send(_token, _accounts, _amounts, _typeId);
    }

    function _send(IERC20 _token, address[] memory _accounts, uint256[] memory _amounts, uint256 _typeId) private {
        for (uint256 i = 0; i < _accounts.length; i++) {
            address account = _accounts[i];
            uint256 amount = _amounts[i];
            _token.transferFrom(msg.sender, account, amount);
        }

        emit BatchSend(_typeId, address(_token), _accounts, _amounts);
    }
}
