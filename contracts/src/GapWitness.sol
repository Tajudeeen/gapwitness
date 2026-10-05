// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GapWitness {
    error GapPaperedOver(bytes32 priorGap, bytes32 nextGap);
    error CommitmentChanged(bytes32 priorSeries, bytes32 nextSeries, bytes32 priorPolicy, bytes32 nextPolicy, uint8 priorVerdict, uint8 nextVerdict);
    error WindowTooWide();
    error EmptySeries();
    error InvalidHourBoundary();
    error InvalidVerdict();

    uint256 public constant MAX_WINDOW_HOURS = 24 * 31;

    struct Commitment {
        bytes32 seriesHash;
        bytes32 gapHash;
        bytes32 policyHash;
        uint8 verdict;
        uint64 committedAt;
        address submitter;
    }

    mapping(bytes32 => Commitment) public commitments;

    event Committed(
        bytes32 indexed commitmentKey,
        bytes32 indexed seriesHash,
        bytes32 gapHash,
        bytes32 policyHash,
        uint8 verdict,
        address indexed submitter
    );

    function commit(
        bytes32 stationId,
        uint64 windowStart,
        uint64 windowEnd,
        bytes32 seriesHash,
        bytes32 gapHash,
        bytes32 policyHash,
        uint8 verdict
    ) external {
        if (seriesHash == bytes32(0)) revert EmptySeries();
        if (windowEnd <= windowStart) revert WindowTooWide();
        if (windowStart % 1 hours != 0 || windowEnd % 1 hours != 0) {
            revert InvalidHourBoundary();
        }
        if (verdict > 2) revert InvalidVerdict();

        uint256 hoursCount = (uint256(windowEnd) - uint256(windowStart)) / 1 hours;
        if (hoursCount == 0 || hoursCount > MAX_WINDOW_HOURS) revert WindowTooWide();

        bytes32 key = keccak256(abi.encode(stationId, windowStart, windowEnd));
        Commitment memory prior = commitments[key];

        if (prior.seriesHash != bytes32(0)) {
            if (prior.gapHash != gapHash) {
                revert GapPaperedOver(prior.gapHash, gapHash);
            }
            if (prior.seriesHash != seriesHash || prior.policyHash != policyHash || prior.verdict != verdict) {
                revert CommitmentChanged(prior.seriesHash, seriesHash, prior.policyHash, policyHash, prior.verdict, verdict);
            }
            // An exact replay is a no-op. Preserve the first witness and emit no new evidence.
            return;
        }

        commitments[key] = Commitment(
            seriesHash,
            gapHash,
            policyHash,
            verdict,
            uint64(block.timestamp),
            msg.sender
        );

        emit Committed(key, seriesHash, gapHash, policyHash, verdict, msg.sender);
    }
}
