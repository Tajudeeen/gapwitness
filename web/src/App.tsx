import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

type Verdict = "INTACT" | "GAPPED" | "IMPOSSIBLE" | null;
type Point = { timestamp: string; value: number };

const DEMO_POINTS: Point[] = Array.from({ length: 24 }, (_, i) => ({
  timestamp: new Date(Date.UTC(2026, 8, 19, 7 + i)).toISOString(),
  value: 8 + Math.sin(i / 2.7) * 3 + i * 0.08,
}));

const DEMO_GAPS = [15, 16, 17, 18, 19, 20, 21];

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [points, setPoints] = useState<Point[]>(DEMO_POINTS);
  const [gaps, setGaps] = useState<number[]>(DEMO_GAPS);
  const [verdict, setVerdict] = useState<Verdict>("GAPPED");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Demo fixture loaded. Seven hours are missing.");
  const [station, setStation] = useState("2178 / Del Norte");
  const [startHour, setStartHour] = useState(7);

  const max = useMemo(() => Math.max(...points.map(p => p.value), 1), [points]);

  async function inspect(upload: File) {
    setBusy(true);
    setMessage("Inspecting bytes against the declared hourly window…");
    try {
      const text = await upload.text();
      const lines = text.trim().split(/\r?\n/).slice(1);
      const parsed = lines.map(line => {
        const [timestamp, value] = line.split(",");
        return { timestamp, value: Number(value) };
      }).filter(p => p.timestamp && Number.isFinite(p.value));
      if (!parsed.length) throw new Error("No valid timestamp,value rows found.");
      const start = new Date(parsed[0].timestamp);
      const end = new Date(start.getTime() + 24 * 3600_000);
      const expected = new Set(Array.from({ length: 24 }, (_, i) =>
        new Date(start.getTime() + i * 3600_000).toISOString()
      ));
      const observed = new Set(parsed.map(p => new Date(p.timestamp).toISOString()));
      const missing = [...expected].filter(ts => !observed.has(ts));
      const impossible = parsed.some(p => p.value < 0);
      setPoints(parsed);
      setGaps(missing.map(ts => Math.round((new Date(ts).getTime() - start.getTime()) / 3600_000)));
      setStartHour(start.getUTCHours());
      setStation(station);
      setVerdict(impossible ? "IMPOSSIBLE" : missing.length ? "GAPPED" : "INTACT");
      setMessage(`${parsed.length} observations inspected against 24 expected UTC hours.`);
      void end;
    } catch (error) {
      setVerdict(null);
      setMessage(error instanceof Error ? error.message : "Inspection failed.");
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (next) {
      setFile(next);
      void inspect(next);
    }
  }

  const chartWidth = 920;
  const chartHeight = 290;
  const left = 54;
  const right = 24;
  const top = 28;
  const bottom = 44;
  const innerW = chartWidth - left - right;
  const innerH = chartHeight - top - bottom;

  return (
    <main className="lab">
      <header className="masthead">
        <div>
          <p className="eyebrow">GAPWITNESS / ENVIRONMENTAL INTEGRITY LAB</p>
          <h1>witness the hours that were missing.</h1>
          <p className="dek">Temporal integrity for environmental time series. The checker decides. The chain remembers.</p>
        </div>
        <div className="status"><span className="dot" /> checker ready</div>
      </header>

      <section className="workspace">
        <aside className="rail">
          <div className="field">
            <label>station</label>
            <input value={station} onChange={e => setStation(e.target.value)} />
          </div>
          <div className="field">
            <label>series</label>
            <div className="readout">PM2.5 / µg/m³</div>
          </div>
          <div className="field">
            <label>window</label>
            <div className="readout">24 hours / UTC</div>
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
              <h2>PM2.5 · {station}</h2>
            </div>
            <span className="timezone">UTC</span>
          </div>

          <div className="chart-wrap">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Hourly PM2.5 observations">
              <line x1={left} y1={top + innerH} x2={chartWidth-right} y2={top+innerH} className="axis" />
              {[0, .5, 1].map(t => <line key={t} x1={left} y1={top + innerH*t} x2={chartWidth-right} y2={top + innerH*t} className="grid" />)}
              {gaps.map(hour => {
                const x = left + (hour / 24) * innerW;
                const w = innerW / 24;
                return <rect key={hour} x={x} y={top} width={w} height={innerH} className="gap-band" />;
              })}
              <polyline
                fill="none"
                className="line"
                points={points.map((p, i) => {
                  const x = left + (i / 23) * innerW;
                  const y = top + innerH - (p.value / max) * innerH * .88;
                  return `${x},${y}`;
                }).join(" ")}
              />
              {points.map((p, i) => {
                const x = left + (i / Math.max(points.length - 1, 1)) * innerW;
                const y = top + innerH - (p.value / max) * innerH * .88;
                return <circle key={p.timestamp} cx={x} cy={y} r="3" className="point"><title>{new Date(p.timestamp).toISOString()} · {p.value.toFixed(2)} µg/m³</title></circle>;
              })}
              {[0, 6, 12, 18, 23].map(i => <text key={i} x={left + (i/23)*innerW} y={chartHeight-15} textAnchor="middle" className="tick">{String((startHour+i)%24).padStart(2,"0")}:00</text>)}
            </svg>
          </div>

          <div className="strip-meta">
            <span>red bands = missing observations</span>
            <span>points = submitted observations</span>
            <span>window = independently declared</span>
          </div>

          <div className={`verdict ${verdict?.toLowerCase() ?? "none"}`}>
            <div>
              <span className="kicker">CHECKER VERDICT</span>
              <strong>{verdict ?? "—"}</strong>
            </div>
            <div className="verdict-copy">
              {verdict === "GAPPED" && <><b>{gaps.length} missing hours.</b> The later window cannot erase this evidence.</>}
              {verdict === "INTACT" && <><b>All expected hours present.</b> No temporal gap detected in this window.</>}
              {verdict === "IMPOSSIBLE" && <><b>Impossible measurement.</b> The PM2.5 policy rejects a negative value.</>}
              {!verdict && <>Run an inspection to produce evidence.</>}
            </div>
          </div>

          <div className="commit-row">
            <div>
              <span className="kicker">NEXT</span>
              <p>Inspect first. Commit only after the deterministic verdict is visible.</p>
            </div>
            <button disabled={!verdict || busy} onClick={() => setMessage("Wallet connection and Sepolia commitment arrive in the next milestone.")}>
              commit evidence →
            </button>
          </div>
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