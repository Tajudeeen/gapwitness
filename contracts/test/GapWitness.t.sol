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
}
