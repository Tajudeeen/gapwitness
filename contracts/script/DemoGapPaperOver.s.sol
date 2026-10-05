// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GapWitness} from "../src/GapWitness.sol";

contract DemoGapPaperOver is Script {
    error ExpectedGapPaperedOver();
    error UnexpectedRevert(bytes4 selector);

    function run() external {
        GapWitness witness = GapWitness(vm.envAddress("GAPWITNESS_ADDRESS"));
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        bytes32 stationId = vm.envBytes32("STATION_ID");
        uint64 windowStart = uint64(vm.envUint("WINDOW_START"));
        uint64 windowEnd = uint64(vm.envUint("WINDOW_END"));

        bytes32 fileASeriesHash = vm.envBytes32("FILE_A_SERIES_HASH");
        bytes32 fileAGapHash = vm.envBytes32("FILE_A_GAP_HASH");
        bytes32 fileAPolicyHash = vm.envBytes32("FILE_A_POLICY_HASH");
        uint8 fileAVerdict = uint8(vm.envUint("FILE_A_VERDICT"));

        bytes32 fileBSeriesHash = vm.envBytes32("FILE_B_SERIES_HASH");
        bytes32 fileBGapHash = vm.envBytes32("FILE_B_GAP_HASH");
        bytes32 fileBPolicyHash = vm.envBytes32("FILE_B_POLICY_HASH");
        uint8 fileBVerdict = uint8(vm.envUint("FILE_B_VERDICT"));

        vm.startBroadcast(privateKey);

        console2.log("GapWitness:", address(witness));
        console2.log("Step 1: committing File A evidence...");

        witness.commit(
            stationId,
            windowStart,
            windowEnd,
            fileASeriesHash,
            fileAGapHash,
            fileAPolicyHash,
            fileAVerdict
        );

        console2.log("Step 1 complete.");
        console2.log("Step 2: attempting File B against the same exact window...");

        bool conflictSeen;
        try witness.commit(
            stationId,
            windowStart,
            windowEnd,
            fileBSeriesHash,
            fileBGapHash,
            fileBPolicyHash,
            fileBVerdict
        ) {
            revert ExpectedGapPaperedOver();
        } catch (bytes memory reason) {
            bytes4 selector;
            assembly {
                selector := mload(add(reason, 32))
            }

            if (selector != GapWitness.GapPaperedOver.selector) {
                revert UnexpectedRevert(selector);
            }

            conflictSeen = true;
            console2.log("GapPaperedOver confirmed.");
            console2.logBytes32(fileAGapHash);
            console2.logBytes32(fileBGapHash);
        }

        vm.stopBroadcast();

        if (!conflictSeen) revert ExpectedGapPaperedOver();
    }
}
