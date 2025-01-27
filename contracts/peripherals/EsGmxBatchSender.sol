// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../staking/interfaces/IVester.sol";
import "../staking/interfaces/IRewardTracker.sol";

contract EsGmxBatchSender {
    address public admin;
    address public esGmx;

    constructor(address _esGmx) {
        admin = msg.sender;
        esGmx = _esGmx;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "EsGmxBatchSender: forbidden");
        _;
    }

    function send(
        IVester _vester,
        uint256 _minRatio,
        address[] memory _accounts,
        uint256[] memory _amounts
    ) external onlyAdmin {
        IRewardTracker rewardTracker = IRewardTracker(_vester.rewardTracker());

        for (uint256 i = 0; i < _accounts.length; i++) {
            IERC20(esGmx).transferFrom(msg.sender, _accounts[i], _amounts[i]);

            uint256 nextTransferredCumulativeReward = _vester.transferredCumulativeRewards(_accounts[i]) + _amounts[i];
            _vester.setTransferredCumulativeRewards(_accounts[i], nextTransferredCumulativeReward);

            uint256 cumulativeReward = rewardTracker.cumulativeRewards(_accounts[i]);
            uint256 totalCumulativeReward = cumulativeReward + nextTransferredCumulativeReward;

            uint256 combinedAverageStakedAmount = _vester.getCombinedAverageStakedAmount(_accounts[i]);

            if (combinedAverageStakedAmount > totalCumulativeReward * _minRatio) {
                continue;
            }

            uint256 nextTransferredAverageStakedAmount = _minRatio * totalCumulativeReward;
            nextTransferredAverageStakedAmount = nextTransferredAverageStakedAmount - (
                rewardTracker.averageStakedAmounts(_accounts[i]) * cumulativeReward / totalCumulativeReward
            );

            nextTransferredAverageStakedAmount = (nextTransferredAverageStakedAmount * totalCumulativeReward) / nextTransferredCumulativeReward;

            _vester.setTransferredAverageStakedAmounts(_accounts[i], nextTransferredAverageStakedAmount);
        }
    }
}
