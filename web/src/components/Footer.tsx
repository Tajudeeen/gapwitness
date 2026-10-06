import { navigateLink, type Navigate } from "../lib/navigation";
import { CONTRACT_ADDRESS, explorerAddressUrl } from "../lib/wallet";

const REPOSITORY = "https://github.com/Tajudeeen/gapwitness";

type FooterProps = {
  navigate: Navigate;
  checkerState: "checking" | "ready" | "offline";
};

export function Footer({ checkerState, navigate }: FooterProps) {
  const checkerLabel = checkerState === "ready"
    ? "Checker reachable"
    : checkerState === "checking" ? "Checking connection" : "Checker unavailable";

  return (
    <footer className="site-footer" role="contentinfo" aria-label="GapWitness resources and attribution">
      <div className="footer-heading">
        <a className="footer-brand" href="#top" aria-label="GapWitness, back to top">
          <img src="/gapwitness-logo.svg" alt="" width="48" height="48" loading="lazy" />
          <span>GapWitness<small>Environmental integrity lab</small></span>
        </a>
        <a className="footer-top-link" href="#top">Back to top <span aria-hidden="true">↑</span></a>
      </div>

      <div className="footer-grid">
        <div className="footer-purpose">
          <h2>Every missing hour deserves a witness.</h2>
          <p>Inspect an environmental CSV against a declared hourly window. Keep its gaps visible, its evidence reproducible, and its commitment open to verification.</p>
          <div className="footer-tags"><span>Deterministic checker</span><span>Ethereum Sepolia</span></div>
        </div>

        <nav className="footer-nav" aria-label="Lab navigation">
          <h3>Explore the lab</h3>
          <a href="?view=lab#source" onClick={event => navigateLink(event, navigate, "lab", "source")}>Source &amp; observation window</a>
          <a href="?view=lab#inspect" onClick={event => navigateLink(event, navigate, "lab", "inspect")}>Inspect the series</a>
          <a href="?view=lab#commit" onClick={event => navigateLink(event, navigate, "lab", "commit")}>Commit the evidence</a>
          <a href="?view=lab#witness" onClick={event => navigateLink(event, navigate, "lab", "witness")}>Understand the proof</a>
        </nav>

        <nav className="footer-nav" aria-label="Verification resources">
          <h3>Verify independently</h3>
          <a href={`${REPOSITORY}#readme`} target="_blank" rel="noopener noreferrer">Project documentation ↗</a>
          <a href={`${REPOSITORY}/blob/main/scripts/verify_onchain.py`} target="_blank" rel="noopener noreferrer">Independent verifier ↗</a>
          <a href={`${REPOSITORY}/blob/main/contracts/src/GapWitness.sol`} target="_blank" rel="noopener noreferrer">Contract source ↗</a>
          {CONTRACT_ADDRESS ? (
            <a href={explorerAddressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noopener noreferrer">Configured Sepolia contract ↗</a>
          ) : <span className="footer-unavailable">Contract not configured</span>}
        </nav>

        <nav className="footer-nav" aria-label="Source and project resources">
          <h3>Source &amp; project</h3>
          <a href={`${REPOSITORY}/blob/main/data/source/openaq-demo.json`} target="_blank" rel="noopener noreferrer">Frozen source manifest ↗</a>
          <a href="https://openaq.org/" target="_blank" rel="noopener noreferrer">OpenAQ data platform ↗</a>
          <a href={REPOSITORY} target="_blank" rel="noopener noreferrer">Browse the repository ↗</a>
          <a href={`${REPOSITORY}/issues/new`} target="_blank" rel="noopener noreferrer">Report an issue ↗</a>
        </nav>
      </div>

      <div className="footer-notes">
        <div><h3>Evidence, with clear limits</h3><p>Temporal integrity does not establish sensor calibration, source honesty, or physical truth. Sepolia is a test network. The contract stores submitted claims and does not run the checker itself.</p></div>
        <div><h3>Data &amp; attribution</h3><p>Frozen fixtures use OpenAQ archive data from AirNow, recorded as US Public Domain in the source manifest. The built-in two-state demo uses synthetic values. Uploaded CSV bytes go to the checker; compact hashes and the verdict go on-chain when you commit.</p></div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} GapWitness</span>
        <span className={`footer-service footer-service-${checkerState}`}><i aria-hidden="true" />{checkerLabel}<small>Last connection check</small></span>
        <a href="https://github.com/Tajudeeen" target="_blank" rel="noopener noreferrer">Built by Deeen_Codes ↗</a>
      </div>
    </footer>
  );
}
