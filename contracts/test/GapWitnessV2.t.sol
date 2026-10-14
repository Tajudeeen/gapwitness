// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {GapWitnessV2} from "../src/GapWitnessV2.sol";
contract GapWitnessV2Test is Test {
    GapWitnessV2 witness;
    bytes32 station = bytes32("2178");
    uint64 start = 1767225600;
    uint64 end = 1767312000;
    bytes32 series = keccak256("source");
    bytes32 gap = keccak256("gaps");
    bytes32 policy = keccak256("policy");
    function setUp() public { witness = new GapWitnessV2(); }
    function testFuzzAttackerCannotOccupyPublisherWindow(address publisher, address attacker) public {
        vm.assume(publisher != address(0) && attacker != address(0) && publisher != attacker);
        vm.prank(attacker);
        witness.commit(station, start, end, keccak256("forged"), keccak256("fake"), policy, 0);
        bytes32 publisherKey = witness.commitmentKey(publisher, station, start, end);
        (bytes32 beforeSeries,,,,,) = witness.commitments(publisherKey);
        assertEq(beforeSeries, bytes32(0));
        vm.prank(publisher);
        witness.commit(station, start, end, series, gap, policy, 1);
        (bytes32 storedSeries,,,,, address owner) = witness.commitments(publisherKey);
        assertEq(storedSeries, series); assertEq(owner, publisher);
    }
    function testReplayIsNoOpAndChangedGapReverts() public {
        vm.warp(1000); witness.commit(station, start, end, series, gap, policy, 1);
        vm.warp(2000); vm.recordLogs(); witness.commit(station, start, end, series, gap, policy, 1);
        assertEq(vm.getRecordedLogs().length, 0);
        (,,,,uint64 firstTime,) = witness.commitments(witness.commitmentKey(address(this), station, start, end));
        assertEq(firstTime, 1000);
        bytes32 next = keccak256("filled");
        vm.expectRevert(abi.encodeWithSelector(GapWitnessV2.GapPaperedOver.selector, gap, next));
        witness.commit(station, start, end, series, next, policy, 0);
    }
    function testChangedPolicyAndVerdictCannotReplaceRecord() public {
        witness.commit(station, start, end, series, gap, policy, 1);
        vm.expectRevert(abi.encodeWithSelector(GapWitnessV2.CommitmentChanged.selector, series, series, policy, policy, 1, 0));
        witness.commit(station, start, end, series, gap, policy, 0);
    }
    function testEmptyStationAndPolicyRejected() public {
        vm.expectRevert(GapWitnessV2.EmptyStation.selector); witness.commit(0, start, end, series, gap, policy, 1);
        vm.expectRevert(GapWitnessV2.EmptyPolicy.selector); witness.commit(station, start, end, series, gap, 0, 1);
    }
}
