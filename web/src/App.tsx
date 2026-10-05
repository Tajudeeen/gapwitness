import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  CHECKER_URL,
  checkHealth,
  inspectCsv,
  type CheckResult,
} from "./lib/checker";
import {
  commitEvidence,
  connectWallet,
  explorerAddressUrl,
  explorerTransactionUrl,
  isContractConfigured,
  CONTRACT_ADDRESS,
  watchWalletEvents,
  CommitmentError,
  WalletError,
} from "./lib/wallet";

type Point = { timestamp: string; value: number };

const DEFAULT_STATION = "2178";
const DEFAULT_WINDOW_START = "2026-09-19T07:00:00Z";
const DEFAULT_WINDOW_END = "2026-09-20T07:00:00Z";

function parseChartPoints(csv: string): Point[] {
  const rows = csv.trim().split(/\r?\n/);
  if (rows.length < 2) return [];

  const header = rows[0].split(",").map(value => value.trim().toLowerCase());
  const timestampIndex = header.indexOf("timestamp");
  const valueIndex = header.indexOf("value");
  if (timestampIndex < 0 || valueIndex < 0) return [];

  return rows.slice(1).flatMap(line => {
    const fields = line.split(",");
    const timestamp = fields[timestampIndex]?.trim();
    const value = Number(fields[valueIndex]?.trim());
    if (!timestamp || !Number.isFinite(value)) return [];
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return [];
    return [{ timestamp: parsed.toISOString(), value }];
  });
}

function errorMessage(status: number, code: string): string {
  if (status === 429) {
    return "Inspect is rate-limited. Try again after the checker window resets.";
  }
  if (status === 422) {
    return `Inspection rejected: ${code}`;
  }
  return `Inspection failed: ${code}`;
}

function formatWindowLabel(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "invalid window";
  }
  const hours = Math.round((endDate.getTime() - startDate.getTime()) / 3600000);
  return `${hours} hours / UTC`;
}


function makeDemoCsv(fillGap: boolean): File {
  const start = Date.parse(DEFAULT_WINDOW_START);
  const rows = ["timestamp,value"];
  for (let hour = 0; hour < 24; hour += 1) {
    if (!fillGap && hour >= 8 && hour < 15) continue;
    const timestamp = new Date(start + hour * 3600000).toISOString();
    rows.push(`${timestamp},${(12.5 + hour * 0.42).toFixed(2)}`);
  }
  return new File([rows.join("\n") + "\n"], fillGap ? "gapwitness-demo-intact.csv" : "gapwitness-demo-gapped.csv", {
    type: "text/csv",
  });
}

function shortHash(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function shortAddress(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function prettyTime(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(11, 16) + " UTC";
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkerState, setCheckerState] = useState<"checking" | "ready" | "offline">("checking");
  const [message, setMessage] = useState("Connect to the checker, then inspect a CSV.");
  const [station, setStation] = useState(DEFAULT_STATION);
  const [windowStart, setWindowStart] = useState(DEFAULT_WINDOW_START);
  const [windowEnd, setWindowEnd] = useState(DEFAULT_WINDOW_END);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [commitBusy, setCommitBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    priorGap: string;
    nextGap: string;
    priorTransactionHash: string | null;
  } | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [primaryResult, setPrimaryResult] = useState<CheckResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<CheckResult | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [activePoint, setActivePoint] = useState<Point | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 2600);
  
  const timelineStart = result ? new Date(result.windowStart).getTime() : new Date(windowStart).getTime();
  const timelineEnd = result ? new Date(result.windowEnd).getTime() : new Date(windowEnd).getTime();
  const timelineHours = result
    ? Array.from({ length: result.expectedHours }, (_, index) => {
        const timestamp = new Date(timelineStart + index * 3600000).toISOString();
        const point = points.find(item => item.timestamp === timestamp);
        const missing = result.missingTimestamps.includes(timestamp);
        return { timestamp, point, missing };
      })
    : [];
  const completeness = result && result.expectedHours > 0
    ? Math.round((result.observedHours / result.expectedHours) * 1000) / 10
    : 0;

  return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal)
      .then(ok => {
        setCheckerState(ok ? "ready" : "offline");
        setMessage(ok ? "Checker is online. Upload a CSV to inspect it." : "Inspect is offline. Commitment is disabled.");
      })
      .catch(() => {
        setCheckerState("offline");
        setMessage("Inspect is offline. Commitment is disabled.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    return watchWalletEvents(({ address, chainId }) => {
      if (address !== null) {
        setWalletAddress(address);
      }
      if (chainId !== null && chainId !== 11155111n) {
        setMessage("Wallet network changed. Commitment requires Ethereum Sepolia.");
      }
    });
  }, []);

  const max = useMemo(
    () => Math.max(...points.map(point => point.value), 1),
    [points],
  );

  const chartWindowStart = useMemo(() => new Date(
    result?.windowStart ?? windowStart,
  ).getTime(), [result?.windowStart, windowStart]);

  const chartWindowEnd = useMemo(() => new Date(
    result?.windowEnd ?? windowEnd,
  ).getTime(), [result?.windowEnd, windowEnd]);

  const segments = useMemo(() => {
    const sorted = [...points].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const grouped: Point[][] = [];
    for (const point of sorted) {
      const last = grouped[grouped.length - 1];
      const previous = last?.[last.length - 1];
      if (!last || !previous ||
        new Date(point.timestamp).getTime() - new Date(previous.timestamp).getTime() > 3600000) {
        grouped.push([point]);
      } else {
        last.push(point);
      }
    }
    return grouped;
  }, [points]);

  async function inspect(upload: File) {
    setBusy(true);
    setResult(null);
    setPoints([]);
    setMessage("Inspecting bytes against the declared hourly window…");

    try {
      const csvText = await upload.text();
      const next = await inspectCsv({
        stationId: station.trim(),
        windowStart,
        windowEnd,
        seriesType: "pm25",
        csv: upload,
      });

      setResult(next);
      setPrimaryResult(next);
      setComparisonResult(null);
      setPoints(parseChartPoints(csvText));
      setCheckerState("ready");
      setTxHash(null);
      setConflict(null);
      setMessage(
        next.verdict === "GAPPED"
          ? `${next.observedHours}/${next.expectedHours} observations verified. ${next.missingTimestamps.length} hours are missing.`
          : next.verdict === "IMPOSSIBLE"
            ? "The checker found a policy violation in the submitted series."
            : "All expected observations are present in the declared window.",
      );
    } catch (error) {
      setResult(null);
      setPoints([]);

      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        "code" in error
      ) {
        const checkerError = error as { status: number; code: string };
        setMessage(errorMessage(checkerError.status, checkerError.code));
      } else {
        setCheckerState("offline");
        setMessage("Inspect is offline. Commitment is disabled.");
      }
    } finally {
      setBusy(false);
    }
  }


  async function runDemo() {
    if (demoBusy) return;
    setDemoBusy(true);
    setMessage("Running the two-state demo: finding the original gap…");
    setResult(null);
    setPrimaryResult(null);
    setComparisonResult(null);
    setPoints([]);
    setFile(null);
    setTxHash(null);
    setConflict(null);

    try {
      const original = makeDemoCsv(false);
      const later = makeDemoCsv(true);
      const originalText = await original.text();
      const first = await inspectCsv({
        stationId: DEFAULT_STATION,
        windowStart: DEFAULT_WINDOW_START,
        windowEnd: DEFAULT_WINDOW_END,
        seriesType: "pm25",
        csv: original,
      });
      setPrimaryResult(first);
      setResult(first);
      setPoints(parseChartPoints(originalText));
      setFile(original);
      setMessage("Original state recorded locally. Now testing the later filled-in version…");

      const second = await inspectCsv({
        stationId: DEFAULT_STATION,
        windowStart: DEFAULT_WINDOW_START,
        windowEnd: DEFAULT_WINDOW_END,
        seriesType: "pm25",
        csv: later,
      });
      setComparisonResult(second);
      setResult(first);
      setMessage("Demo complete: the same exact window moved from GAPPED to INTACT. No commitment was sent.");
      setCheckerState("ready");
    } catch {
      setMessage("Demo could not complete. The checker must be online.");
      setCheckerState("offline");
    } finally {
      setDemoBusy(false);
    }
  }

  async function handleCommit() {
    if (!result) return;

    setCommitBusy(true);
    setConflict(null);
    setTxHash(null);
    setMessage("Connecting wallet…");

    try {
      const wallet = await connectWallet();
      setWalletAddress(wallet.address);
      setMessage("Confirm the evidence commitment in your wallet…");

      const receipt = await commitEvidence(result.chainCommitment);
      setTxHash(receipt.transactionHash);
      setMessage(`Evidence committed on Sepolia in block ${receipt.blockNumber}.`);
    } catch (error) {
      if (error instanceof CommitmentError) {
        if (error.conflict) {
          setConflict({
            priorGap: error.conflict.priorGap,
            nextGap: error.conflict.nextGap,
            priorTransactionHash: error.conflict.priorTransactionHash,
          });
          setMessage("GapPaperedOver: the later submission conflicts with the prior commitment.");
        } else {
          setMessage(error.message);
        }
      } else if (error instanceof WalletError) {
        setMessage(error.message);
      } else {
        setMessage("Commitment failed. The evidence remains unchanged.");
      }
    } finally {
      setCommitBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    void inspect(next);
  }

  const chartWidth = 920;
  const chartHeight = 290;
  const left = 54;
  const right = 24;
  const top = 28;
  const bottom = 44;
  const innerW = chartWidth - left - right;
  const innerH = chartHeight - top - bottom;
  const span = Math.max(chartWindowEnd - chartWindowStart, 1);

  function xFor(timestamp: string): number {
    const time = new Date(timestamp).getTime();
    return left + ((time - chartWindowStart) / span) * innerW;
  }

  function yFor(value: number): number {
    return top + innerH - (value / max) * innerH * 0.88;
  }

  const ticks = useMemo(() => {
    const start = new Date(result?.windowStart ?? windowStart);
    return [0, 6, 12, 18].map(offset => {
      const value = new Date(start.getTime() + offset * 3600000);
      return { offset, label: `${String(value.getUTCHours()).padStart(2, "0")}:00` };
    });
  }, [result?.windowStart, windowStart]);

  return (
    <>
      <div className={`splash ${showIntro ? "is-visible" : "is-hidden"}`} aria-hidden={!showIntro}>
        <div className="splash-inner">
          <img src="/gapwitness-logo.svg" alt="" className="splash-logo" />
          <p className="splash-name">GAPWITNESS</p>
          <p className="splash-line">witness the hours that were missing.</p>
          <div className="splash-progress"><span /></div>
          <span className="splash-meta">TEMPORAL INTEGRITY / ENVIRONMENTAL TIME SERIES</span>
        </div>
      </div>
      <main className={`lab ${showIntro ? "is-behind-splash" : ""}`}>
      <header className="masthead">
        <div className="brand">
          <img className="brand-mark" src="/gapwitness-logo.svg" alt="GapWitness logo" />
          <div>
            <p className="eyebrow">GAPWITNESS / ENVIRONMENTAL INTEGRITY LAB</p>
          <h1>witness the hours that were missing.</h1>
            <p className="dek">Temporal integrity for environmental time series. The checker decides. The chain remembers.</p>
            <div className="hero-actions">
              <button type="button" className="demo-button" onClick={() => void runDemo()} disabled={demoBusy || checkerState !== "ready"}>
                {demoBusy ? "running demo…" : "run the 2-state demo →"}
              </button>
              <span>gapped → intact → same window → conflict</span>
            </div>
          </div>
        </div>
        <div className={`status ${checkerState}`}>
          <span className="dot" />
          {checkerState === "checking" ? "checking checker" : checkerState === "ready" ? "checker ready" : "checker offline"}
        </div>
        <div className="steps">
          {[
            ["01 SOURCE", "source"],
            ["02 INSPECT", "inspect"],
            ["03 COMMIT", "commit"],
            ["04 WITNESS", "witness"],
          ].map(([step, target], index) => (
            <a
              key={step}
              className={result || index < 2 ? "active" : ""}
              href={`#${target}`}
            >
              <span>{step}</span><i />
            </a>
          ))}
        </div>
        <div className="explain-strip" aria-label="How GapWitness works">
          <div className="explain-intro">
            <span className="kicker">IN ONE MINUTE</span>
            <strong>upload → inspect → witness</strong>
          </div>
          <details>
            <summary><span>01</span><b>UPLOAD</b><small>your CSV stays the source</small></summary>
            <p>GapWitness reads the submitted bytes against the hourly window you declare.</p>
          </details>
          <details>
            <summary><span>02</span><b>INSPECT</b><small>rules produce the verdict</small></summary>
            <p>The deterministic checker finds missing hours and policy violations. No AI decides the result.</p>
          </details>
          <details>
            <summary><span>03</span><b>WITNESS</b><small>the chain remembers</small></summary>
            <p>Only compact hashes and the verdict are committed on Sepolia. The CSV itself stays off-chain.</p>
          </details>
        </div>
      </header>

      <section className="workspace">
        <aside className="rail" id="source">
          <div className="field">
            <label>station</label>
            <input value={station} onChange={event => setStation(event.target.value)} />
          </div>

          <div className="field">
            <label>series</label>
            <div className="readout">PM2.5 / µg/m³</div>
          </div>

          <div className="field">
            <label>window start</label>
            <input
              value={windowStart}
              onChange={event => setWindowStart(event.target.value)}
              aria-label="Observation window start"
            />
          </div>

          <div className="field">
            <label>window end</label>
            <input
              value={windowEnd}
              onChange={event => setWindowEnd(event.target.value)}
              aria-label="Observation window end"
            />
          </div>

          <div className="field">
            <label>window</label>
            <div className="readout">{formatWindowLabel(windowStart, windowEnd)}</div>
          </div>

          <div className="field">
            <label>source</label>
            <div className="readout">OpenAQ archive</div>
          </div>

          <label className={`upload${busy ? " is-busy" : ""}`}>
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
            <strong>{file ? file.name : "inspect a CSV"}</strong>
            <span>1 MB max · timestamp,value</span>
          </label>

          <button type="button" className="rail-demo" onClick={() => void runDemo()} disabled={demoBusy || checkerState !== "ready"}>
            {demoBusy ? "running evidence demo…" : "try the built-in demo"}
          </button>

          <p className="message" aria-live="polite">{busy ? "● " : ""}{message}</p>
        </aside>

        <section className="main-panel" id="inspect">
          <div className="panel-head" aria-label="Inspection results">
            <div>
              <span className="kicker">HOURLY OBSERVATION STRIP</span>
              <h2>PM2.5 · {result?.stationId ?? station}</h2>
            </div>
            <span className="timezone">UTC</span>
          </div>

          <div className="chart-wrap">
            {!points.length && (
              <div className="chart-empty">
                <div className="empty-mark">+</div>
                <strong>your evidence will appear here</strong>
                <span>Upload a CSV to see every submitted hour, missing intervals, and the checker verdict.</span>
              </div>
            )}
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Hourly PM2.5 observations">
              <line x1={left} y1={top + innerH} x2={chartWidth - right} y2={top + innerH} className="axis" />
              {[0, 0.5, 1].map(t => (
                <line
                  key={t}
                  x1={left}
                  y1={top + innerH * t}
                  x2={chartWidth - right}
                  y2={top + innerH * t}
                  className="grid"
                />
              ))}

              {(result?.missingTimestamps ?? []).map(timestamp => {
                const x = xFor(timestamp);
                const width = innerW / Math.max(result?.expectedHours ?? 24, 1);
                return <rect key={timestamp} x={x} y={top} width={width} height={innerH} className="gap-band" />;
              })}

              {segments.map(segment => (
                <polyline
                  key={segment[0].timestamp}
                  fill="none"
                  className="line"
                  points={segment.map(point => `${xFor(point.timestamp)},${yFor(point.value)}`).join(" ")}
                />
              ))}

              {points.map(point => {
                const x = xFor(point.timestamp);
                const y = yFor(point.value);
                return (
                  <circle key={point.timestamp} cx={x} cy={y} r="3" className="point">
                    <title>{point.timestamp} · {point.value.toFixed(2)} µg/m³</title>
                  </circle>
                );
              })}

              {ticks.map(tick => (
                <text
                  key={tick.offset}
                  x={left + (tick.offset / Math.max((result?.expectedHours ?? 24) - 1, 1)) * innerW}
                  y={chartHeight - 15}
                  textAnchor="middle"
                  className="tick"
                >
                  {tick.label}
                </text>
              ))}
            </svg>
          </div>

          {result && (
            <section className="evidence-timeline" aria-label="Evidence timeline">
              <div className="timeline-head">
                <div>
                  <span className="kicker">EVIDENCE TIMELINE</span>
                  <h3>the hole in the hour-by-hour record.</h3>
                </div>
                <span>{result.expectedHours} expected · {result.observedHours} observed</span>
              </div>
              <div className="timeline-grid">
                {timelineHours.map(hour => (
                  <button
                    type="button"
                    key={hour.timestamp}
                    className={`timeline-hour ${hour.missing ? "missing" : "observed"} ${activePoint?.timestamp === hour.timestamp ? "selected" : ""}`}
                    onClick={() => setActivePoint(hour.point ?? { timestamp: hour.timestamp, value: NaN })}
                    aria-label={`${prettyTime(hour.timestamp)}: ${hour.missing ? "missing" : `observed ${hour.point?.value.toFixed(2)} micrograms per cubic meter`}`}
                  >
                    <span>{hour.timestamp.slice(11, 13)}</span>
                    <i />
                  </button>
                ))}
              </div>
              {activePoint && (
                <div className="hour-detail">
                  <span>{prettyTime(activePoint.timestamp)}</span>
                  <strong>{Number.isFinite(activePoint.value) ? `${activePoint.value.toFixed(2)} µg/m³` : "MISSING"}</strong>
                  <small>{Number.isFinite(activePoint.value) ? "submitted observation" : "expected observation not present"}</small>
                </div>
              )}
            </section>
          )}

          <div className="strip-meta">
            <span><i className="legend-dot gap" /> missing hours</span>
            <span><i className="legend-dot point" /> submitted observations</span>
            <span><i className="legend-dot verdict-dot" /> deterministic verdict</span>
            <button type="button" className="why-button" onClick={() => document.getElementById("witness")?.scrollIntoView({ behavior: "smooth" })}>why this matters ↓</button>
          </div>

          <div className={`verdict ${result?.verdict?.toLowerCase() ?? "none"}`} aria-live="polite">
            <div>
              <span className="kicker">CHECKER VERDICT</span>
              <strong>{result?.verdict ?? "—"}</strong>
            </div>
            <div className="verdict-copy">
              {result?.verdict === "GAPPED" && (
                <><b>{result.missingTimestamps.length} missing hours.</b> {result.materialGap ? "This is a material gap." : "The declared window contains a gap."}</>
              )}
              {result?.verdict === "INTACT" && (
                <><b>All expected hours present.</b> No temporal gap detected in this window.</>
              )}
              {result?.verdict === "IMPOSSIBLE" && (
                <><b>{result.impossibleTimestamps.length} impossible observation{result.impossibleTimestamps.length === 1 ? "" : "s"}.</b> The PM2.5 policy rejects negative values.</>
              )}
              {!result && <>Run the checker to produce deterministic evidence.</>}
            </div>
          </div>

          {result && (
            <section className="evidence-summary">
              <div className="summary-head">
                <div>
                  <span className="kicker">EVIDENCE SUMMARY</span>
                  <h3>what the checker actually found.</h3>
                </div>
                <strong>{completeness}% complete</strong>
              </div>
              <div className="summary-metrics">
                <div><span>EXPECTED</span><b>{result.expectedHours}</b><small>hourly observations</small></div>
                <div><span>OBSERVED</span><b>{result.observedHours}</b><small>submitted observations</small></div>
                <div className={result.missingTimestamps.length ? "negative" : ""}><span>MISSING</span><b>{result.missingTimestamps.length}</b><small>hours in the window</small></div>
                <div className={result.impossibleTimestamps.length ? "negative" : ""}><span>INVALID</span><b>{result.impossibleTimestamps.length}</b><small>policy violations</small></div>
              </div>
            </section>
          )}

          {primaryResult && comparisonResult && (
            <section className="comparison" aria-label="Before and after comparison">
              <div className="comparison-title">
                <span className="kicker">BEFORE / AFTER</span>
                <h3>the same window, two different temporal states.</h3>
              </div>
              <div className="comparison-grid">
                <article className="comparison-card original">
                  <span className="comparison-label">ORIGINAL SUBMISSION</span>
                  <strong>{primaryResult.verdict}</strong>
                  <b>{primaryResult.missingTimestamps.length} missing hours</b>
                  <code>gap {shortHash(primaryResult.gapHash)}</code>
                </article>
                <div className="comparison-arrow">→</div>
                <article className="comparison-card later">
                  <span className="comparison-label">LATER SUBMISSION</span>
                  <strong>{comparisonResult.verdict}</strong>
                  <b>{comparisonResult.missingTimestamps.length} missing hours</b>
                  <code>gap {shortHash(comparisonResult.gapHash)}</code>
                </article>
              </div>
              <div className="comparison-conflict">
                <span>⚠</span>
                <div>
                  <strong>GAP PAPERED OVER</strong>
                  <p>same station · same exact window · different temporal state</p>
                </div>
              </div>
            </section>
          )}

          {result && (
            <section className="evidence">
              <div>
                <span className="kicker">EVIDENCE HASHES</span>
                <h3>the bytes become proof material.</h3>
              </div>
              <div className="hash-list">
                {[
                  ["seriesHash", result.seriesHash],
                  ["gapHash", result.gapHash],
                  ["policyHash", result.policyHash],
                ].map(([label, value]) => (
                  <div className="hash-row" key={label}>
                    <span>{label}</span>
                    <code title={value}>{value}</code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(value)}
                      aria-label={`Copy ${label}`}
                    >
                      copy
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result && (
            <section className="chain-state">
              <div>
                <span className="kicker">CHAIN</span>
                <h3>sepolia commitment</h3>
              </div>
              <div className="chain-lines">
                <div><span>contract</span><code>{isContractConfigured() ? "configured" : "not configured"}</code></div>
                <div><span>wallet</span><code>{walletAddress ? walletAddress : "not connected"}</code></div>
                <div><span>verdict code</span><code>{result.chainCommitment.verdict}</code></div>
              </div>
              {txHash && (
                <p className="chain-success">
                  committed · <a href={explorerTransactionUrl(txHash)} target="_blank" rel="noreferrer">{txHash}</a>
                  {walletAddress && <> · <a href={explorerAddressUrl(walletAddress)} target="_blank" rel="noreferrer">wallet</a></>}
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
                <span className="receipt-status">COMMITTED · SEPOLIA</span>
              </div>
              <div className="receipt-grid">
                <div><span>STATION</span><b>{result.stationId}</b></div>
                <div><span>WINDOW</span><b>{new Date(result.windowStart).toISOString().slice(0,16).replace("T"," ")} → {new Date(result.windowEnd).toISOString().slice(11,16)} UTC</b></div>
                <div><span>VERDICT</span><b>{result.verdict}</b></div>
                <div><span>MISSING</span><b>{result.missingTimestamps.length} HOURS</b></div>
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
              disabled={!result || checkerState !== "ready" || busy || commitBusy || !isContractConfigured()}
              onClick={() => void handleCommit()}
            >
              {commitBusy ? "waiting for wallet…" : walletAddress ? "commit evidence →" : "connect wallet & commit →"}
            </button>
          </div>

          <p className="endpoint-note">checker: {CHECKER_URL}</p>
        </section>
      </section>

      <section className="proof-drawer" id="witness">
        <div className="proof-title">
          <span className="kicker">READ THE EVIDENCE CORRECTLY</span>
          <h2>strong claims. narrow claims.</h2>
          <p>GapWitness is deliberately precise about what its proof can and cannot establish.</p>
        </div>
        <div className="proof-cards">
          <details open><summary><span>✓</span><b>WHAT THIS PROVES</b><i>+</i></summary><p>the submitted bytes, the expected missing timestamps, the deterministic policy result, and whether a later submission conflicts with the same exact window.</p></details>
          <details><summary><span>×</span><b>WHAT THIS DOES NOT PROVE</b><i>+</i></summary><p>sensor calibration, physical truth, source honesty, or that a measurement was scientifically correct. Integrity is not truth.</p></details>
          <details><summary><span>!</span><b>INSUFFICIENT DATA</b><i>+</i></summary><p>not a verdict. If the checker cannot establish a usable evidence window, it returns 422 and no verdict is committed.</p></details>
        </div>
      </section>

      <footer>
        <span>GAPWITNESS · TEMPORAL INTEGRITY FOR ENVIRONMENTAL TIME SERIES</span>
        <span>INTEGRITY ≠ TRUTH</span>
      </footer>
    </main>
    </>
  );
}

export default App;
