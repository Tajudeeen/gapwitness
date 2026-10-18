import type { CheckResult } from '../lib/checker';
import {CONTRACT_VERSION,CONTRACT_ADDRESS,isContractConfigured,explorerAddressUrl,explorerTransactionUrl} from '../lib/wallet';
const shortHash=(value:string)=>value.length>18?value.slice(0,10)+'…'+value.slice(-8):value;
const shortAddress=(value:string)=>value.length>14?value.slice(0,8)+'…'+value.slice(-6):value;
type Props={result:CheckResult|null;walletAddress:string|null;txHash:string|null;txPublisher:string|null;commitCreated:boolean;
  conflict:{priorGap:string;nextGap:string;priorTransactionHash:string|null}|null;busy:boolean;demoBusy:boolean;commitBusy:boolean;
  checkerState:'checking'|'ready'|'offline';showReceipt:boolean;setShowReceipt:(value:boolean)=>void;handleCommit:()=>Promise<void>};
export function WitnessPanel({result,walletAddress,txHash,txPublisher,commitCreated,conflict,busy,demoBusy,commitBusy,
  checkerState,showReceipt,setShowReceipt,handleCommit}:Props){return <>
          {result && (
            <section className="chain-state">
              <div>
                <span className="kicker">CHAIN</span>
                <h3>sepolia commitment</h3>
                <p>{CONTRACT_VERSION === 2 ? "Publisher-scoped records. Another wallet cannot occupy your namespace." : "Historical global namespace. Station ownership is not authenticated."}</p>
              </div>
              <div className="chain-lines">
                <div><span>contract</span><code>{isContractConfigured() ? "configured" : "not configured"}</code></div>
                <div><span>wallet</span><code>{walletAddress ? walletAddress : "not connected"}</code></div>
                <div><span>verdict code</span><code>{result.chainCommitment.verdict}</code></div>
              </div>
              {txHash && (
                <p className="chain-success">
                  committed · <a href={explorerTransactionUrl(txHash)} target="_blank" rel="noreferrer">{txHash}</a>
                  {txPublisher && <> · <a href={explorerAddressUrl(txPublisher)} target="_blank" rel="noreferrer">publisher</a></>}
                </p>
              )}
              {conflict && (
                <div className="conflict">
                  <strong>GapPaperedOver</strong>
                  <span>prior gap: <code>{conflict.priorGap}</code></span>
                  <span>new gap: <code>{conflict.nextGap}</code></span>
                  {conflict.priorTransactionHash && (
                    <a href={explorerTransactionUrl(conflict.priorTransactionHash)} target="_blank" rel="noreferrer">
                      view prior commitment →
                    </a>
                  )}
                </div>
              )}
            </section>
          )}

          {txHash && result && (
            <section className="receipt" aria-label="Evidence receipt">
              <div className="receipt-top">
                <div>
                  <span className="kicker">EVIDENCE RECEIPT</span>
                  <h3>temporal integrity witness</h3>
                </div>
                <span className="receipt-status">{commitCreated ? "WITNESSED" : "REPLAY CONFIRMED"} · SEPOLIA</span>
              </div>
              <div className="receipt-grid">
                <div><span>STATION</span><b>{result.stationId}</b></div>
                <div><span>WINDOW</span><b>{new Date(result.windowStart).toISOString().slice(0,16).replace("T"," ")} → {new Date(result.windowEnd).toISOString().slice(11,16)} UTC</b></div>
                <div><span>VERDICT</span><b>{result.verdict}</b></div>
                <div><span>MISSING</span><b>{result.missingTimestamps.length} HOURS</b></div>
                <div><span>PUBLISHER</span><code>{txPublisher}</code></div>
                <div><span>TX</span><code>{shortHash(txHash)}</code></div>
                <div><span>CONTRACT</span><code>{shortAddress(CONTRACT_ADDRESS || "not configured")}</code></div>
              </div>
              <div className="receipt-actions">
                <a href={explorerTransactionUrl(txHash)} target="_blank" rel="noreferrer">view transaction →</a>
                {CONTRACT_ADDRESS && <a href={explorerAddressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">view contract →</a>}
                <button type="button" onClick={() => setShowReceipt(!showReceipt)}>{showReceipt ? "hide printable view" : "show printable view"}</button>
              </div>
              {showReceipt && <div className="receipt-print"><strong>GAPWITNESS / {result.verdict}</strong><span>{result.stationId} · {result.missingTimestamps.length} missing hours</span><code>{txHash}</code></div>}
            </section>
          )}

          <div className="commit-row" id="commit">
            <div>
              <span className="kicker">COMMIT</span>
              <p>
                {isContractConfigured()
                  ? walletAddress
                    ? "Wallet connected. The next click sends the checker evidence to Sepolia."
                    : "Your wallet is only requested when you choose to commit."
                  : "Sepolia contract address is not configured yet. Commitment is disabled."}
              </p>
            </div>
            <button
              disabled={!result || checkerState !== "ready" || busy || demoBusy || commitBusy || !isContractConfigured()}
              onClick={() => void handleCommit()}
            >
              {commitBusy ? "waiting for wallet…" : walletAddress ? "commit evidence →" : "connect wallet & commit →"}
            </button>
          </div>


</>;}
