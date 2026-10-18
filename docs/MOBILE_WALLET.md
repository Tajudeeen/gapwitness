# Mobile and browser publishing

Inspection, review, export, and public Sepolia verification require no wallet. The Publish page has separate connection controls and a transaction button.

- **Connect browser wallet** uses the wallet injected into the current browser. This also works in a wallet's in-app browser.
- **Pair MetaMask mobile / QR** loads the official `@metamask/connect-evm` client only on request. It provides MetaMask's desktop QR or mobile app handoff while the original page retains its inspection. No WalletConnect project ID or private RPC key is needed.
- Connection requests account permission and Sepolia selection. It does not sign or publish. The combined **connect wallet & commit** button remains available for an injected wallet and explicitly requests publication.
- **Disconnect wallet** clears the active connection here and disconnects a MetaMask relay session. It retains the inspection. Browser wallet permissions can also be removed in the wallet itself.
- Cancelled connections cannot restore the UI or proceed to network switching after a late permission approval.
- A malformed network event clears the connected state. Publication checks Sepolia immediately before proceeding and includes Sepolia's chain ID in the transaction request.
- The app validates the pinned runtime, V2 contract version, publisher record, and receipt after publication. User rejection, wrong networks, and immutable-record conflicts retain the inspection.

The SDK uses its own relay infrastructure for pairing and public RPC endpoints for supported-network reads. Dapp-side analytics are disabled. Neither the CSV nor raw measurements are passed to the SDK by GapWitness. The SDK is not loaded during normal inspection.

Automated tests cover injected-wallet connection without signing, wrong-network refusal, listener cleanup, cancellation, missing-wallet recovery, retained evidence, and mobile layout. A real phone approval through the external MetaMask relay still requires a wallet owner. Do not describe browser mocks or seeing a QR dialog as a completed real-wallet transaction.

Vite explicitly selects the MWP core ESM entry and prebundles eciesjs. This avoids missing named exports in dynamic imports. A browser regression initializes the actual SDK and its crypto/session storage, observes the relay transport attempt, and opens/closes the real SDK QR dialog with its external relay deliberately blocked. It does not claim phone approval.

## Phone acceptance check

1. In a normal phone browser, inspect File A and open Publish.
2. Choose Pair MetaMask mobile / QR. Approve account access in MetaMask and return to the same browser tab.
3. Confirm Sepolia, the connected account, and the retained 17/24 GAPPED inspection.
4. Choose Commit evidence. Inspect the wallet's destination, chain and requested call before approving with test ETH.
5. Wait for the mined receipt and independently verify it using the original CSV and exported evidence.
6. Repeat with wallet rejection and disconnect. The retained inspection must remain available.

SDK documentation: https://docs.metamask.io/metamask-connect/evm/quickstart/javascript/

The SDK's `@metamask/utils` dependencies used uuid 9. An npm override pins those uuid consumers to patched 11.1.1, which retains the UUID APIs used by the SDK. Re-run build, tests, SDK initialization and the production dependency audit when changing this override.
