// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GapWitnessV2} from "../src/GapWitnessV2.sol";

contract DeployGapWitnessV2 is Script {
    function run() external returns (GapWitnessV2 deployed) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        deployed = new GapWitnessV2();
        vm.stopBroadcast();

        console2.log("GapWitnessV2 deployed at:", address(deployed));
    }
}
