import sourceA from "../../checker/demo/file_a.csv?raw";
import sourceB from "../../checker/demo/file_b.csv?raw";
import sourceC from "../../checker/demo/file_c_impossible.csv?raw";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Landing } from "./components/Landing";
import { navigateLink } from "./lib/navigation";
import { Footer } from "./components/Footer";
import { ReviewPanel } from "./components/ReviewPanel";
import { WitnessPanel } from "./components/WitnessPanel";
import { WorkspaceNav } from "./components/WorkspaceNav";
import { PageFrame } from "./components/PageFrame";
import { PAGE_PATHS, readPage, type Page } from "./lib/navigation";
import { type EvidencePackage, type ChainClaim } from "./lib/packages";
import {
  CHECKER_URL,
  checkHealth,
  inspectCsv,
  type CheckResult,
} from "./lib/checker";
import {
  commitEvidence,
  connectWallet,
  isContractConfigured,
  CONTRACT_ADDRESS,
  CONTRACT_VERSION,
  getCommitmentKey,
  watchWalletEvents,
  CommitmentError,
  WalletError,
} from "./lib/wallet";

type Point = { timestamp: string; value: number };

const DEFAULT_STATION = "2178";
const DEFAULT_WINDOW_START = "2026-09-19T07:00:00Z";
const DEFAULT_WINDOW_END = "2026-09-20T07:00:00Z";
const EvidencePage = lazy(() => import("./components/EvidencePage").then(module => ({default:module.EvidencePage})));
const VerifyPage = lazy(() => import("./components/VerifyPage").then(module => ({default:module.VerifyPage})));

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

function prettyTime(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(11, 16) + " UTC";
}

function App() {
  const [view, setView] = useState<Page>(() => readPage(new URL(window.location.href)));
  function navigate(next: Page, section = "top") {
    if (next === "lab") next = section === "commit" ? "publish" : section === "witness" ? "verify" : "inspect";
    const url = new URL(window.location.href);
    url.pathname = PAGE_PATHS[next];
    url.searchParams.delete("view");
    url.hash = section === "top" ? "" : section;
    window.history.pushState(null, "", url);
    setView(next);
    window.requestAnimationFrame(() => {
      const target = document.getElementById(section);
      target?.scrollIntoView({ behavior: "instant" });
      if (section === "top") {
        document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
      }
    });
  }
  useEffect(() => {
    const onPopState = () => setView(readPage(new URL(window.location.href)));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    document.title = view === "home" ? "GapWitness | Keep the missing hours visible" : `${view === "lab" ? "Inspection lab" : view[0].toUpperCase() + view.slice(1)} | GapWitness`;
    if (view !== "home") window.requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true}));
  }, [view]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(920);
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [view]);
  const inspectionRequest = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const commitInFlight = useRef(false);
  const [sourceKind, setSourceKind] = useState<"upload" | "synthetic" | "openaq">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [activeCsv, setActiveCsv] = useState<File | null>(null);
  const [importedChain, setImportedChain] = useState<ChainClaim | null>(null);
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
  const [txPublisher, setTxPublisher] = useState<string | null>(null);
  const [commitCreated, setCommitCreated] = useState(true);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    priorGap: string;
    nextGap: string;
    priorTransactionHash: string | null;
  } | null>(null);
  const [showIntro, setShowIntro] = useState(() => new URLSearchParams(window.location.search).get("view") === "lab");
  const [primaryResult, setPrimaryResult] = useState<CheckResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<CheckResult | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [activePoint, setActivePoint] = useState<Point | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 2600);
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
      if (chainId === null) setWalletAddress(address);
      if (chainId !== null && chainId !== 11155111n) {
        setMessage("Wallet network changed. Commitment requires Ethereum Sepolia.");
      }
    });
  }, []);

  function clearEvidence() {
    setActiveCsv(null);
    setImportedChain(null);
    setResult(null);
    setPrimaryResult(null);
    setComparisonResult(null);
    setPoints([]);
    setActivePoint(null);
    setTxHash(null);
    setTxPublisher(null);
    setConflict(null);
    setShowReceipt(false);
  }

  function cancelInspection() {
    inspectionRequest.current.controller?.abort();
    inspectionRequest.current.id += 1;
    inspectionRequest.current.controller = null;
    setBusy(false);
    setDemoBusy(false);
  }

  function beginInspection() {
    cancelInspection();
    const controller = new AbortController();
    inspectionRequest.current.controller = controller;
    const id = inspectionRequest.current.id;
    clearEvidence();
    return { signal: controller.signal, current: () => id === inspectionRequest.current.id && !controller.signal.aborted };
  }

  useEffect(() => () => {
    inspectionRequest.current.controller?.abort();
    inspectionRequest.current.id += 1;
  }, []);

  function changeInput(setter: (value: string) => void, value: string) {
    if (commitInFlight.current) return;
    cancelInspection();
    clearEvidence();
    setter(value);
    setMessage("Inputs changed. Inspect the selected CSV again before committing.");
  }

  async function inspect(upload: File, context = { stationId: station.trim(), windowStart, windowEnd }, source: "upload" | "openaq" = "upload") {
    if (commitInFlight.current) return;
    const request = beginInspection();
    setBusy(true);
    setSourceKind(source);
    setMessage("Inspecting bytes against the declared hourly window…");

    try {
      const next = await inspectCsv({
        ...context,
        seriesType: "pm25", csv: upload, signal: request.signal,
      });
      if (!request.current()) return;
      setResult(next);
      setActiveCsv(upload);
      setPrimaryResult(next);
      setPoints(next.observations);
      setCheckerState("ready");
      setMessage(next.verdict === "GAPPED"
        ? `${next.observedHours}/${next.expectedHours} observations verified. ${next.missingTimestamps.length} hours are missing.`
        : next.verdict === "IMPOSSIBLE"
          ? "The checker found a policy violation in the submitted series."
          : "All expected observations are present in the declared window.");
    } catch (error) {
      if (!request.current()) return;
      clearEvidence();
      if (typeof error === "object" && error !== null && "status" in error && "code" in error) {
        const checkerError = error as { status: number; code: string };
        setMessage(errorMessage(checkerError.status, checkerError.code));
      } else {
        setCheckerState("offline");
        setMessage("Inspect is offline. Commitment is disabled.");
      }
    } finally {
      if (request.current()) setBusy(false);
    }
  }

  function loadSourceFixture(name: "a" | "b" | "c") {
    if (commitInFlight.current) return;
    const text = {a: sourceA, b: sourceB, c: sourceC}[name];
    const fixture = new File([text], `file_${name}${name === "c" ? "_impossible" : ""}.csv`, {type: "text/csv"});
    setStation(DEFAULT_STATION); setWindowStart(DEFAULT_WINDOW_START); setWindowEnd(DEFAULT_WINDOW_END); setFile(fixture);
    void inspect(fixture, {stationId: DEFAULT_STATION, windowStart: DEFAULT_WINDOW_START, windowEnd: DEFAULT_WINDOW_END}, "openaq");
  }

  function downloadEvidence() {
    const proof = evidencePackage();
    if (!proof) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(proof, null, 2) + "\n"], {type: "application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = "gapwitness-evidence.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function evidencePackage(): EvidencePackage | null {
    if (!result) return null;
    const publisher = txPublisher;
    return {format: "gapwitness/evidence/v1", source: sourceKind,
      csvFilename: activeCsv?.name ?? file?.name ?? "original.csv", originalCsvRequired: true, browserEvidenceCheck: "matched",
      evidence: result, chain: txHash && publisher ? {chainId: 11155111, contract: CONTRACT_ADDRESS,
        contractVersion: CONTRACT_VERSION, publisher, transactionHash: txHash,
        commitmentKey: getCommitmentKey(result.chainCommitment, publisher),
        operation: commitCreated ? "first-witness" : "exact-replay"} : importedChain,
      chainVerification: txHash ? "Receipt and record matched by the connected wallet provider" : "No fresh independent chain check",
      limits: ["Wallet identity does not certify station authority.", "Temporal completeness does not prove measurement accuracy."]};
  }

  function openSaved(bundle: EvidencePackage, original: File) {
    if (commitInFlight.current) throw new Error("Wait for the wallet operation before opening another record.");
    if (bundle.evidence.seriesType !== "pm25") throw new Error("The web workspace supports PM2.5. Use the local batch reviewer for a generic series.");
    cancelInspection(); clearEvidence();
    setResult(bundle.evidence); setPoints(bundle.evidence.observations);setActiveCsv(original);setFile(original);
    setStation(bundle.evidence.stationId);setWindowStart(bundle.evidence.windowStart);setWindowEnd(bundle.evidence.windowEnd);
    setSourceKind("upload");setImportedChain(bundle.chain);
    setMessage("Saved CSV independently rechecked. Its chain metadata has not been freshly verified.");
    navigate("review");
  }

  async function runDemo() {
    if (commitInFlight.current) return;
    const request = beginInspection();
    setDemoBusy(true);
    setSourceKind("synthetic");
    setStation(DEFAULT_STATION);
    setWindowStart(DEFAULT_WINDOW_START);
    setWindowEnd(DEFAULT_WINDOW_END);
    setFile(null);
    setMessage("Running the synthetic comparison: finding the original gap…");
    try {
      const original = makeDemoCsv(false);
      const first = await inspectCsv({
        stationId: DEFAULT_STATION, windowStart: DEFAULT_WINDOW_START,
        windowEnd: DEFAULT_WINDOW_END, seriesType: "pm25", csv: original, signal: request.signal,
      });
      if (!request.current()) return;
      const second = await inspectCsv({
        stationId: DEFAULT_STATION, windowStart: DEFAULT_WINDOW_START,
        windowEnd: DEFAULT_WINDOW_END, seriesType: "pm25", csv: makeDemoCsv(true), signal: request.signal,
      });
      if (!request.current()) return;
      setPrimaryResult(first);
      setComparisonResult(second);
      setResult(first);
      setActiveCsv(original);
      setPoints(first.observations);
      setFile(original);
      setMessage("Comparison complete: GAPPED to INTACT for the same window. Synthetic data; no on-chain conflict was tested.");
      setCheckerState("ready");
    } catch (error) {
      if (!request.current()) return;
      clearEvidence();
      setMessage(typeof error === "object" && error !== null && "code" in error
        ? String(error.code) : "Comparison could not complete. The checker must be online.");
    } finally {
      if (request.current()) setDemoBusy(false);
    }
  }

  async function handleCommit() {
    if (!result || busy || demoBusy || commitInFlight.current) return;
    commitInFlight.current = true;
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
      setTxPublisher(receipt.publisher); setCommitCreated(receipt.created);
      setMessage(receipt.created ? `Evidence witnessed on Sepolia in block ${receipt.blockNumber}.` : "Exact replay confirmed. The first witness and its timestamp were preserved.");
    } catch (error) {
      if (error instanceof CommitmentError) {
        if (error.conflict) {
          setConflict({
            priorGap: error.conflict.priorGap,
            nextGap: error.conflict.nextGap,
            priorTransactionHash: error.conflict.priorTransactionHash,
          });
          setMessage("GapPaperedOver: the later evidence differs from this publisher’s first witness. This alone does not establish tampering.");
        } else {
          setMessage(error.message);
        }
      } else if (error instanceof WalletError) {
        setMessage(error.message);
      } else {
        setMessage("Commitment failed. The evidence remains unchanged.");
      }
    } finally {
      commitInFlight.current = false;
      setCommitBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (commitInFlight.current) return;
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    void inspect(next);
  }

  const timelineStart = result ? new Date(result.windowStart).getTime() : new Date(windowStart).getTime();
  const pointsByHour = new Map(points.map(point => [Date.parse(point.timestamp), point]));
  const missingHours = new Set(result?.missingTimestamps.map(timestamp => Date.parse(timestamp)) ?? []);
  const timelineHours = result
    ? Array.from({ length: result.expectedHours }, (_, index) => {
        const time = timelineStart + index * 3600000;
        const timestamp = new Date(time).toISOString();
        const point = pointsByHour.get(time);
        const missing = missingHours.has(time);
        return { timestamp, point, missing };
      })
    : [];
  const chartHeight = 290;
  const left = 54;
  const right = 24;
  const top = 30;
  const innerW = chartWidth - left - right;
  const innerH = chartHeight - top - 44;
  const chartValues = timelineHours.flatMap(hour => hour.point ? [hour.point.value] : []);
  const minimum = Math.min(0, ...chartValues);
  const maximum = Math.max(1, ...chartValues);
  const scaleMagnitude = Math.max(Math.abs(minimum), Math.abs(maximum));
  const yFor = (value: number) => top + innerH * (maximum / scaleMagnitude - value / scaleMagnitude) / (maximum / scaleMagnitude - minimum / scaleMagnitude);
  const zeroY = yFor(0);
  const slotWidth = innerW / Math.max(timelineHours.length, 1);
  const barInset = Math.min(4, slotWidth * 0.16);
  const tickOffsets = chartWidth < 500 ? [0, Math.floor(timelineHours.length / 2), timelineHours.length - 1] : [0, Math.floor(timelineHours.length / 4), Math.floor(timelineHours.length / 2), Math.floor(timelineHours.length * 3 / 4), timelineHours.length - 1];
  const ticks = [...new Set(tickOffsets)].filter(index => index >= 0 && index < timelineHours.length);
  const completeness = result && result.expectedHours > 0
    ? Math.round((result.observedHours / result.expectedHours) * 1000) / 10
    : 0;

  const witnessPanel = <WitnessPanel result={result} walletAddress={walletAddress} txHash={txHash}
    txPublisher={txPublisher} commitCreated={commitCreated} conflict={conflict} busy={busy} demoBusy={demoBusy}
    commitBusy={commitBusy} checkerState={checkerState} showReceipt={showReceipt} setShowReceipt={setShowReceipt}
    handleCommit={handleCommit} />;
  const emptyReview = <section className="page-card"><h2>Start with an inspection</h2><p>Declare the station and UTC window, then inspect the original CSV. No wallet is needed.</p><button onClick={() => navigate("inspect")}>Inspect a CSV</button></section>;

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
      {view !== "home" && <WorkspaceNav page={view} navigate={navigate} />}
      <Suspense fallback={<PageFrame title="Opening page" description="Loading the requested workspace." ><p role="status">Loading page…</p></PageFrame>}>
      {view === "home" ? <Landing navigate={navigate} checkerState={checkerState} /> : view === "lab" || view === "inspect" ? <main id="top" className={`lab ${showIntro ? "is-behind-splash" : ""}`}>
      <a className="lab-home-link" href="/" onClick={event => navigateLink(event, navigate, "home")}>← GapWitness home</a>
      <header className="masthead">
        <div className="brand">
          <img className="brand-mark" src="/gapwitness-logo.svg" alt="GapWitness logo" />
          <div>
            <p className="eyebrow">GAPWITNESS / ENVIRONMENTAL INTEGRITY LAB</p>
          <h1 tabIndex={-1}>{view === "lab" ? "witness the hours that were missing." : "Inspect an hourly CSV."}</h1>
            <p className="dek">Declare the reporting window, inspect the original file, and see exactly which hours are missing.</p>
            <div className="hero-actions">
              <button type="button" className="demo-button" onClick={() => void runDemo()} disabled={busy || demoBusy || commitBusy || checkerState !== "ready"}>
                {demoBusy ? "running demo…" : "run the 2-state demo →"}
              </button>
              <span>synthetic comparison · no transaction</span>
            </div>
          </div>
        </div>
        <div className={`status ${checkerState}`}>
          <span className="dot" />
          {checkerState === "checking" ? "checking checker" : checkerState === "ready" ? "checker ready" : "checker offline"}
        </div>
        <div className="steps">
          {[
            ["01 INSPECT", "inspect"],
            ["02 REVIEW", "review"],
            ["03 KEEP", "evidence"],
            ["04 PUBLISH", "publish"],
            ["05 VERIFY", "verify"],
          ].map(([step, target], index) => (
            <a
              key={step}
              className={index === 0 ? "active" : ""}
              href={PAGE_PATHS[target as Page]}
              onClick={event => navigateLink(event, navigate, target as Page)}
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
            <label htmlFor="station-id">station</label>
            <input id="station-id" disabled={commitBusy} value={station} onChange={event => changeInput(setStation, event.target.value)} />
          </div>

          <div className="field">
            <label>series</label>
            <div className="readout">PM2.5 / µg/m³</div>
          </div>

          <div className="field">
            <label>window start</label>
            <input
              value={windowStart}
              disabled={commitBusy}
              onChange={event => changeInput(setWindowStart, event.target.value)}
              aria-label="Observation window start"
            />
          </div>

          <div className="field">
            <label>window end</label>
            <input
              value={windowEnd}
              disabled={commitBusy}
              onChange={event => changeInput(setWindowEnd, event.target.value)}
              aria-label="Observation window end"
            />
          </div>

          <div className="field">
            <label>window</label>
            <small>Use the reporting schedule, not the first and last CSV rows.</small>
            <div className="readout">{formatWindowLabel(windowStart, windowEnd)}</div>
          </div>

          <div className="field">
            <label>source</label>
            <div className="readout">{sourceKind === "synthetic" ? "Synthetic browser demo" : sourceKind === "openaq" ? "Frozen OpenAQ fixture · recorded provenance" : "Uploaded CSV · source unverified"}</div>
          </div>

          <label className={`upload${busy ? " is-busy" : ""}`}>
            <input type="file" accept=".csv,text/csv" disabled={commitBusy} onChange={onFileChange} />
            <strong>{file ? file.name : "inspect a CSV"}</strong>
            <span>1 MB max · timestamp,value</span>
          </label>

          <button type="button" className="rail-demo" onClick={() => void runDemo()} disabled={busy || demoBusy || commitBusy || checkerState !== "ready"}>
            {demoBusy ? "running evidence demo…" : "try the built-in demo"}
          </button>

          <div className="fixture-actions" aria-label="Frozen source fixtures">
            <p>Source-backed examples, station 2178</p>
            <button type="button" disabled={commitBusy} onClick={() => loadSourceFixture("a")}>load File A · 7 deliberate gaps</button>
            <button type="button" disabled={commitBusy} onClick={() => loadSourceFixture("b")}>load File B · complete source window</button>
            <button type="button" disabled={commitBusy} onClick={() => loadSourceFixture("c")}>load File C · policy test</button>
          </div>
          {file && <button type="button" className="rail-demo" disabled={busy || demoBusy || commitBusy} onClick={() => void inspect(file)}>inspect selected CSV again</button>}

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

          <div className="chart-wrap" ref={chartRef}>
            {!points.length && (
              <div className="chart-empty">
                <div className="empty-mark">+</div>
                <strong>your evidence will appear here</strong>
                <span>Upload a CSV to see every submitted hour, missing intervals, and the checker verdict.</span>
              </div>
            )}
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={result ? `Hourly PM2.5 bar chart: ${result.expectedHours} expected hours, ${result.observedHours} observed, ${result.missingTimestamps.length} missing. Values in micrograms per cubic meter.` : "Hourly PM2.5 bar chart. Upload a CSV to inspect a declared window."}>
              <defs>
                <pattern id="hour-gap-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#f0dfb8" />
                  <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke="#c5a767" strokeWidth="0.8" />
                </pattern>
              </defs>
              <text x={left} y="16" className="tick">µg/m³</text>
              {[maximum, ...(minimum < 0 ? [0, minimum] : [maximum / 2, 0])].map(value => (
                <g key={value}>
                  <line x1={left} y1={yFor(value)} x2={chartWidth - right} y2={yFor(value)} className={value === 0 ? "axis" : "grid"} />
                  <text x={left - 8} y={yFor(value) + 3} textAnchor="end" className="tick">{Number(value.toPrecision(3))}</text>
                </g>
              ))}
              {timelineHours.map((hour, index) => {
                const x = left + index * slotWidth + barInset;
                const width = slotWidth - barInset * 2;
                const value = hour.point?.value;
                return (
                  <g key={hour.timestamp} className="hour-column">
                    <title>{hour.timestamp} · {hour.missing ? "missing observation" : `${value?.toFixed(2)} µg/m³`}</title>
                    {hour.missing ? (
                      <rect x={x} y={top} width={width} height={innerH} className="gap-band" />
                    ) : value !== undefined && value === 0 ? (
                      <line x1={x} y1={zeroY} x2={x + width} y2={zeroY} className="zero-observation" />
                    ) : value !== undefined ? (
                      <rect x={x} y={Math.min(yFor(value), zeroY)} width={width} height={Math.abs(yFor(value) - zeroY)} className={`hour-bar ${value < 0 ? "invalid" : ""}`} />
                    ) : null}
                  </g>
                );
              })}
              {ticks.map(index => (
                <text key={index} x={left + (index + 0.5) * slotWidth} y={chartHeight - 15} textAnchor={index === 0 ? "start" : index === timelineHours.length - 1 ? "end" : "middle"} className="tick">
                  {timelineHours.length > 24 ? `${timelineHours[index].timestamp.slice(5, 10)} ` : ""}{timelineHours[index].timestamp.slice(11, 16)}
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
                    className={`timeline-hour ${hour.missing ? "missing" : "observed"} ${activePoint && Date.parse(activePoint.timestamp) === Date.parse(hour.timestamp) ? "selected" : ""}`}
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
            {result && result.impossibleTimestamps.length > 0 && <span><i className="legend-dot invalid" /> negative measurement</span>}
            <span><i className="legend-dot verdict-dot" /> deterministic verdict</span>
            <button type="button" className="why-button" onClick={() => navigate("verify")}>Verify the proof →</button>
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
                  <strong>DIFFERENT GAP EVIDENCE</strong>
                  <p>same station · same exact window · synthetic comparison, no chain rejection tested</p>
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
              <p>CSV bytes, missing hours, and verdict independently checked in this browser.</p>
              <button type="button" onClick={downloadEvidence}>download evidence JSON</button>
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

          {view === "lab" && result && <ReviewPanel evidence={result} filename={file?.name ?? "synthetic-demo.csv"} source={sourceKind} />}

          {view === "lab" && witnessPanel}
          {view === "inspect" && <div className="page-actions next-steps"><button disabled={!result || busy || demoBusy} onClick={() => navigate("review")}>Continue to review</button><button disabled={!result || busy || demoBusy} onClick={() => navigate("publish")}>Publish on Sepolia</button></div>}

          <p className="endpoint-note">checker: {CHECKER_URL}</p>
        </section>
      </section>

      {view === "lab" && <section className="proof-drawer" id="witness">
        <div className="proof-title">
          <span className="kicker">READ THE EVIDENCE CORRECTLY</span>
          <h2>strong claims. narrow claims.</h2>
          <p>GapWitness is deliberately precise about what its proof can and cannot establish.</p>
        </div>
        <div className="proof-cards">
          <details open><summary><span>✓</span><b>WHAT THIS PROVES</b><i>+</i></summary><p>the submitted bytes, expected missing timestamps, deterministic policy result, and whether later evidence conflicts with the same publisher, station, and exact window.</p></details>
          <details><summary><span>×</span><b>WHAT THIS DOES NOT PROVE</b><i>+</i></summary><p>sensor calibration, physical truth, source honesty, or that a measurement was scientifically correct. Integrity is not truth.</p></details>
          <details><summary><span>!</span><b>INSUFFICIENT DATA</b><i>+</i></summary><p>not a verdict. If the checker cannot establish a usable evidence window, it returns 422 and no verdict is committed.</p></details>
        </div>
      </section>}

      <Footer checkerState={checkerState} navigate={navigate} />
    </main> : view === "review" ? <PageFrame title="Review the inspection" description="Decide what needs explanation, compare a prior revision, and keep a printable record.">
      {result ? <><div className="page-card"><h2>Station {result.stationId} · {result.verdict}</h2><p>{result.windowStart} to {result.windowEnd}</p><span className="proof-label">Original bytes independently checked in this browser</span></div>
        <ReviewPanel evidence={result} filename={activeCsv?.name ?? "original.csv"} source={sourceKind} />
        <div className="page-actions"><button onClick={() => navigate("evidence")}>Keep this evidence</button><button onClick={() => navigate("publish")}>Publish on Sepolia</button><button onClick={() => navigate("inspect")}>Edit source and window</button></div></> : emptyReview}
    </PageFrame> : view === "evidence" ? <EvidencePage current={evidencePackage()} csv={activeCsv} onOpen={openSaved} navigate={navigate} />
      : view === "publish" ? <PageFrame title="Publish a testnet witness" description="Optional Sepolia publication preserves your evidence in your publisher namespace. It is not a certificate of station authority.">
        {result ? <section className="page-card"><h2>Station {result.stationId} · {result.verdict}</h2><p>{result.windowStart} to {result.windowEnd}</p><p>{result.missingTimestamps.length} missing hours. Original bytes independently checked in this browser.</p></section> : emptyReview}
        {witnessPanel}<p role="status" className="page-message">{message}</p>
        {txHash && <div className="page-actions"><button onClick={() => navigate("verify")}>Independently verify this witness</button><button onClick={() => navigate("evidence")}>Save CSV and receipt metadata</button></div>}
      </PageFrame> : view === "verify" ? <VerifyPage current={evidencePackage()} csv={activeCsv} />
      : <PageFrame title="Page not found" description="Choose a page from the workspace navigation."><button onClick={() => navigate("inspect")}>Open inspection</button></PageFrame>}
      </Suspense>
      {view !== "home" && view !== "inspect" && view !== "lab" && <Footer checkerState={checkerState} navigate={navigate} />}
    </>
  );
}

export default App;
