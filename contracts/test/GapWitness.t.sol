// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GapWitness} from "../src/GapWitness.sol";

contract GapWitnessTest is Test {
    GapWitness witness;
    bytes32 station = keccak256("demo-station");
    uint64 start = 1767225600;
    uint64 end = start + 24 hours;
    bytes32 seriesA = keccak256("file-a");
    bytes32 gapA = keccak256("gap-a");
    bytes32 gapB = keccak256("gap-b");
    bytes32 policy = keccak256("policy-v1");

    function setUp() public {
        witness = new GapWitness();
    }

    function testCommitAndRepeatSameGap() public {
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
    }

    function testConflictingGapReverts() public {
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        vm.expectRevert(
            abi.encodeWithSelector(GapWitness.GapPaperedOver.selector, gapA, gapB)
        );
        witness.commit(station, start, end, keccak256("file-b"), gapB, policy, 1);
    }


    function testSameGapButDifferentSeriesReverts() public {
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        bytes32 seriesB = keccak256("file-b");
        vm.expectRevert(
            abi.encodeWithSelector(
                GapWitness.CommitmentChanged.selector,
                seriesA,
                seriesB,
                policy,
                policy,
                1,
                1
            )
        );
        witness.commit(station, start, end, seriesB, gapA, policy, 1);
    }

    function testSameSeriesAndGapButDifferentPolicyReverts() public {
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        bytes32 policyB = keccak256("policy-v2");
        vm.expectRevert(
            abi.encodeWithSelector(
                GapWitness.CommitmentChanged.selector,
                seriesA,
                seriesA,
                policy,
                policyB,
                1,
                1
            )
        );
        witness.commit(station, start, end, seriesA, gapA, policyB, 1);
    }

    function testDifferentWindowDoesNotConflict() public {
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        witness.commit(
            station,
            start + 24 hours,
            end + 24 hours,
            keccak256("file-b"),
            gapB,
            policy,
            1
        );
    }

    function testUnalignedWindowReverts() public {
        vm.expectRevert(GapWitness.InvalidHourBoundary.selector);
        witness.commit(station, start + 1, end, seriesA, gapA, policy, 1);
    }

    function testInvalidVerdictReverts() public {
        vm.expectRevert(GapWitness.InvalidVerdict.selector);
        witness.commit(station, start, end, seriesA, gapA, policy, 3);
    }

    function testReplayPreservesFirstWitnessAndEmitsNoEvent() public {
        address first = address(0xA11CE);
        address replay = address(0xB0B);
        vm.warp(1000);
        vm.prank(first);
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        bytes32 key = keccak256(abi.encode(station, start, end));
        vm.warp(2000);
        vm.recordLogs();
        vm.prank(replay);
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        assertEq(vm.getRecordedLogs().length, 0);
        (bytes32 storedSeries, bytes32 storedGap, bytes32 storedPolicy, uint8 verdict, uint64 committedAt, address submitter) = witness.commitments(key);
        assertEq(storedSeries, seriesA);
        assertEq(storedGap, gapA);
        assertEq(storedPolicy, policy);
        assertEq(verdict, 1);
        assertEq(committedAt, 1000);
        assertEq(submitter, first);
    }

    function testFuzzReplayPreservesFirstWitness(address first, address replay, uint64 delay) public {
        vm.assume(first != address(0));
        vm.warp(1000);
        vm.prank(first);
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        vm.warp(uint256(delay) + 1000);
        vm.prank(replay);
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        bytes32 key = keccak256(abi.encode(station, start, end));
        (, , , , uint64 committedAt, address submitter) = witness.commitments(key);
        assertEq(committedAt, 1000);
        assertEq(submitter, first);
    }

    function testSameEvidenceButDifferentVerdictReverts() public {
        witness.commit(station, start, end, seriesA, gapA, policy, 1);
        vm.expectRevert(abi.encodeWithSelector(
            GapWitness.CommitmentChanged.selector, seriesA, seriesA, policy, policy, 1, 0
        ));
        witness.commit(station, start, end, seriesA, gapA, policy, 0);
    }
}
