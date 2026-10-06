import type { CSSProperties, MouseEvent } from "react";
import { navigateLink, type Navigate } from "../lib/navigation";
import { Footer } from "./Footer";

const REPOSITORY = "https://github.com/Tajudeeen/gapwitness";
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function Landing({ navigate, checkerState }: {
  navigate: Navigate;
  checkerState: "checking" | "ready" | "offline";
}) {
  const openLab = (event: MouseEvent<HTMLAnchorElement>) => navigateLink(event, navigate, "lab");
  return (
    <main className="landing" id="top">
      <a className="landing-skip" href="#overview">Skip to overview</a>
      <header className="landing-nav">
        <a className="landing-brand" href="#top"><img src="/gapwitness-logo.svg" alt="" width="40" height="40" />GapWitness</a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#evidence">The evidence</a>
          <a className="landing-nav-cta" href="?view=lab" onClick={openLab}>Open the lab <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="landing-hero" id="overview" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> ENVIRONMENTAL DATA / TEMPORAL INTEGRITY</p>
          <h1 id="landing-title" tabIndex={-1}>The missing hours<br />tell a story.<br /><em>Keep the evidence.</em></h1>
          <p className="landing-intro">A clean chart can hide an incomplete record. GapWitness checks an hourly environmental CSV against the window you declare, reveals what is missing, and lets you preserve a verifiable commitment.</p>
          <div className="landing-actions"><a className="landing-button" href="?view=lab" onClick={openLab}>Inspect your data <span aria-hidden="true">↗</span></a><a className="landing-text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
          <p className="landing-caption">No wallet needed to inspect. Optional commitments on Ethereum Sepolia.</p>
        </div>
        <div className="landing-specimen">
          <div className="specimen-heading"><span>FIELD NOTE / 001</span><span>ILLUSTRATIVE RECORD</span></div>
          <div className="specimen-title"><h2>A day with seven<br />hours missing.</h2><span className="specimen-verdict">GAPPED</span></div>
          <div className="specimen-chart" role="img" aria-label="Illustration of 24 expected hours: 17 observed and seven missing, from hours 08 to 14. Synthetic data, not a checker result.">
            {HOURS.map(hour => <div key={hour} className={hour >= 8 && hour < 15 ? "specimen-hour is-missing" : "specimen-hour"} style={{ "--bar-height": `${28 + ((hour * 17 + 21) % 62)}%` } as CSSProperties}><span /></div>)}
          </div>
          <div className="specimen-axis"><span>00:00</span><span>08:00</span><span>16:00</span><span>24:00 UTC</span></div>
          <div className="specimen-key"><span><i />Observed hour</span><span><i />Missing hour</span></div>
          <div className="specimen-stats"><div><strong>24</strong><span>EXPECTED HOURS</span></div><div><strong>17</strong><span>OBSERVED HOURS</span></div><div><strong>07</strong><span>MISSING HOURS</span></div></div>
          <p className="specimen-note">The space is the evidence. Lines should not bridge hours that were never submitted.</p>
          <p className="landing-caption">Synthetic illustration. Upload a CSV in the lab for an actual result.</p>
        </div>
      </section>

      <div className="landing-principles" aria-label="Product principles"><span>Declared window</span><span>Deterministic rules</span><span>Reproducible hashes</span><span>Optional on-chain record</span></div>

      <section className="landing-section landing-problem" aria-labelledby="problem-title">
        <div><p className="landing-eyebrow">01 / THE PROBLEM</p><h2 id="problem-title">A file hash remembers<br />the file.<br /><em>What remembers the gap?</em></h2></div>
        <div className="landing-prose"><p>Remove a few inconvenient observations, then hash the remaining file. That hash faithfully preserves the edited bytes. It does not explain which hours should have been there.</p><p>GapWitness starts with a station and an independently declared UTC window. It compares every expected hourly timestamp with the submitted record, so missing observations stay part of the review.</p><p className="landing-margin-note">Built for environmental reviewers, researchers, and auditors working with hourly PM2.5 data.</p></div>
      </section>

      <section className="landing-section" id="how-it-works" aria-labelledby="workflow-title">
        <div className="landing-section-heading"><div><p className="landing-eyebrow">02 / FROM FILE TO EVIDENCE</p><h2 id="workflow-title">Three steps. A traceable record.</h2></div><a className="landing-text-link" href="?view=lab" onClick={openLab}>Try it in the lab ↗</a></div>
        <div className="landing-steps">
          <article><span className="landing-step-number">01</span><h3>Declare the window.</h3><p>Choose the station, start time, and end time in UTC. Upload your hourly CSV with timestamp and value columns.</p><span className="landing-step-label">YOUR FILE + YOUR EXPECTED WINDOW</span></article>
          <article><span className="landing-step-number">02</span><h3>Inspect what is there.</h3><p>See missing hours, invalid negative PM2.5 values, the policy verdict, and hashes of the submitted bytes and evidence.</p><span className="landing-step-label">DETERMINISTIC CHECKER / NO WALLET</span></article>
          <article><span className="landing-step-number">03</span><h3>Commit if you choose.</h3><p>Connect a wallet to store compact hashes and the verdict on Sepolia. Compare later submissions for the same station and window.</p><span className="landing-step-label">TEST NETWORK / TEST ETH REQUIRED</span></article>
        </div>
      </section>

      <section className="landing-section landing-evidence" id="evidence" aria-labelledby="evidence-title">
        <div className="landing-section-heading"><div><p className="landing-eyebrow">03 / READ THE RESULT</p><h2 id="evidence-title">A verdict you can inspect.</h2></div><p>Every result includes the declared window,<br />missing timestamps, and evidence hashes.</p></div>
        <div className="landing-verdicts">
          <article><span className="landing-verdict intact">INTACT</span><h3>All hours accounted for.</h3><p>Every expected hour is present. No configured hard rule is violated.</p></article>
          <article><span className="landing-verdict gapped">GAPPED</span><h3>The record has a gap.</h3><p>At least one expected hour is missing. The result lists the absent timestamps.</p></article>
          <article><span className="landing-verdict impossible">IMPOSSIBLE</span><h3>A hard rule is broken.</h3><p>An in-window PM2.5 value is negative. This verdict takes priority when gaps also exist.</p></article>
        </div>
        <p className="landing-caption">Unusable input is rejected without a verdict. An intact record does not establish that its measurements are true.</p>
      </section>

      <section className="landing-section landing-trust" aria-labelledby="trust-title">
        <div><p className="landing-eyebrow">04 / OPEN TO VERIFICATION</p><h2 id="trust-title">Evidence with<br /><em>honest boundaries.</em></h2><p>Temporal integrity is a specific claim. It does not prove sensor calibration, source honesty, or physical truth.</p></div>
        <div className="landing-trust-resources"><article><h3>Reproduce the result</h3><p>Explore the checker, frozen OpenAQ fixtures, data provenance, and independent verification scripts.</p><a href={`${REPOSITORY}#readme`} target="_blank" rel="noreferrer">Read the documentation ↗</a></article><article><h3>Inspect the commitment</h3><p>The permissionless contract stores submitted claims; it does not execute the checker. The first submission establishes the record for an exact station and window.</p><a href={`${REPOSITORY}/blob/main/contracts/deployments/replay-proof.json`} target="_blank" rel="noreferrer">View the recorded replay proof ↗</a></article></div>
      </section>

      <section className="landing-closing" aria-labelledby="start-title"><p className="landing-eyebrow">START WITH THE RECORD YOU HAVE</p><h2 id="start-title">Make the missing hours visible.</h2><p>Upload a CSV or run the lab’s synthetic two-state demo.</p><a className="landing-button" href="?view=lab" onClick={openLab}>Open the inspection lab <span aria-hidden="true">↗</span></a></section>
      <Footer checkerState={checkerState} navigate={navigate} />
    </main>
  );
}
