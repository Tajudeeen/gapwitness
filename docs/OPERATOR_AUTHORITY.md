# Operator delegation

The Verify page can prepare an unsigned EIP-712 delegation request and check a signed response. It binds the exact station identifier, publisher, HTTPS reference hash, validity interval, Sepolia chain, and deployed V2 contract. The maximum validity interval is thirty days.

The reviewer must obtain the operator's signing address independently, for example through a published operator-controlled page or a separately authenticated exchange. A matching signature proves control of that supplied signing key. It does not establish that the signer operates the station. An arbitrary website URL is context, not authentication.

1. Confirm the station and publisher in Verify.
2. Enter an operator-controlled HTTPS reference and download the unsigned request.
3. Send the request to the operator yourself. No outreach is sent by the application.
4. The operator signs on their own machine. Private keys never go into the application or an evidence package.
5. Import the signed response and compare against the independently obtained operator wallet.
6. Retain the operator-to-key evidence together with the signature check.

Operator-side command:

```sh
cd web
# Set AUTHORITY_PRIVATE_KEY locally using the operator's own secure procedure.
node scripts/sign_operator_delegation.mjs request.json signed-delegation.json
```

The app reports stationAuthorityIndependentlyEstablished as false. This release has no operator directory, revocation registry, or proof of historical authorization. Contract publishing does not enforce this optional delegation. No genuine operator response has been collected. Synthetic signatures in tests are explicitly test fixtures.
