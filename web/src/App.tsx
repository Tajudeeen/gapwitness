import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  CHECKER_URL,
  checkHealth,
  inspectCsv,
  type CheckResult,
  type Verdict,
} from "./lib/checker";

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
      setPoints(parseChartPoints(csvText));
      setCheckerState("ready");
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
    <main className="lab">
      <header className="masthead">
        <div>
          <p className="eyebrow">GAPWITNESS / ENVIRONMENTAL INTEGRITY LAB</p>
          <h1>witness the hours that were missing.</h1>
          <p className="dek">Temporal integrity for environmental time series. The checker decides. The chain remembers.</p>
        </div>
        <div className={`status ${checkerState}`}>
          <span className="dot" />
          {checkerState === "checking" ? "checking checker" : checkerState === "ready" ? "checker ready" : "checker offline"}
        </div>
      </header>

      <section className="workspace">
        <aside className="rail">
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

          <label className="upload">
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
            <strong>{file ? file.name : "inspect a CSV"}</strong>
            <span>1 MB max · timestamp,value</span>
          </label>

          <p className="message">{busy ? "● " : ""}{message}</p>
        </aside>

        <section className="main-panel">
          <div className="panel-head">
            <div>
              <span className="kicker">HOURLY OBSERVATION STRIP</span>
              <h2>PM2.5 · {result?.stationId ?? station}</h2>
            </div>
            <span className="timezone">UTC</span>
          </div>

          <div className="chart-wrap">
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

          <div className="strip-meta">
            <span>red bands = missing observations</span>
            <span>points = submitted observations</span>
            <span>verdict = checker output</span>
          </div>

          <div className={`verdict ${result?.verdict?.toLowerCase() ?? "none"}`}>
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

          <div className="commit-row">
            <div>
              <span className="kicker">NEXT</span>
              <p>{result ? "Evidence is ready. Wallet commitment is the next milestone." : "Inspect first. Commit only after the deterministic verdict is visible."}</p>
            </div>
            <button
              disabled={!result || checkerState !== "ready" || busy}
              onClick={() => setMessage("Wallet connection and Sepolia commitment arrive in the next milestone.")}
            >
              commit evidence →
            </button>
          </div>

          <p className="endpoint-note">checker: {CHECKER_URL}</p>
        </section>
      </section>

      <footer>
        <span>GAPWITNESS · temporal integrity</span>
        <span>integrity is not truth.</span>
      </footer>
    </main>
  );
}

export default App;
