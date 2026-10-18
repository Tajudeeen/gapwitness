type Props = {
  address: string | null;
  busy: boolean;
  locked: boolean;
  onConnect: (mode: 'browser' | 'metamask') => Promise<void>;
  onDisconnect: () => Promise<void>;
};

export function WalletConnection({ address, busy, locked, onConnect, onDisconnect }: Props) {
  return <section className="page-card wallet-connection" aria-label="Wallet connection">
    <span className="kicker">OPTIONAL PUBLICATION</span>
    <h2>{address ? 'Wallet connected' : 'Choose how to connect'}</h2>
    {address ? <p><code>{address}</code></p> :
      <p>Use a browser wallet, or pair the MetaMask app from your phone. Desktop users can scan the QR code. Keep this tab open while approving the connection.</p>}
    <p>Ethereum Sepolia only. Connecting doesn’t publish or request a signature. Publishing needs test ETH and a separate wallet approval.</p>
    <div className="page-actions">
      {!address && !busy && <>
        <button disabled={locked} onClick={() => void onConnect('browser')}>Connect browser wallet</button>
        <button disabled={locked} onClick={() => void onConnect('metamask')}>Pair MetaMask mobile / QR</button>
      </>}
      {busy && <span role="status">Approve the connection in your wallet, or cancel below.</span>}
      {(address || busy) && <button disabled={locked} onClick={() => void onDisconnect()}>{busy ? 'Cancel pairing' : 'Disconnect wallet'}</button>}
    </div>
    <details><summary>Connection help</summary><p>If the app doesn’t open, unlock MetaMask and retry. Enable test networks and select Sepolia. You can also open this site in your wallet’s browser. Inspection and public proof verification work without a wallet.</p></details>
  </section>;
}
