// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract MaliciousTraderTest {
    event Received();

    address public positionRouter;

    constructor(address _positionRouter) {
        positionRouter = _positionRouter;
    }

    receive() external payable {
        // just consume lot of gas
        uint256 a;
        for (uint i = 0; i < 1000000; i++) {
            a = a * i;
        }
        emit Received();
    }

    function createIncreasePositionETH(
        address[] memory _path,
        address _indexToken,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) external payable {
        console.log("path.length %s indexToken %s minOut %s", _path.length, _indexToken, _minOut);
        console.log("sizeDelta %s isLong %s acceptablePrice %s", _sizeDelta, _isLong, _acceptablePrice);
        console.log("executionFee %s callbackTarget %s", _executionFee, _callbackTarget);
        (bool success, bytes memory reason) = positionRouter.call{value: msg.value}(
            abi.encodeWithSignature(
                "createIncreasePositionETH(address[],address,uint256,uint256,bool,uint256,uint256,bytes32,address)",
                _path,
                _indexToken,
                _minOut,
                _sizeDelta,
                _isLong,
                _acceptablePrice,
                _executionFee,
                _referralCode,
                _callbackTarget
            )
        );
        console.log("success: %s reason: '%s'", success, string(reason));
        require(success, string(reason));
    }
}
