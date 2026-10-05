// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GapWitness} from "../src/GapWitness.sol";

contract DeployGapWitness is Script {
    function run() external returns (GapWitness deployed) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        deployed = new GapWitness();
        vm.stopBroadcast();

        console2.log("GapWitness deployed at:", address(deployed));
    }
}
