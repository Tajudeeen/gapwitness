# AI Architecture and Epistemic Separation in GapWitness

> **Core Philosophy:** In regulatory compliance, carbon accounting, and environmental law, non-deterministic AI outputs (hallucinations, stochastic drift) are a severe liability. Court-admissible evidence requires 100% reproducible, zero-hallucination mathematical proof.
>
> GapWitness enforces a **clean separation** between its **deterministic cryptographic verification kernel** and its **intelligent AI assistance layers**.

---

## 1. The Separation of Concerns

```
                  UNSTRUCTURED CSV & USER INPUT
                                │
                                ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  LAYER 1: INTELLIGENT INGEST & SCHEMA INFERENCE (AI)         │
  │  - Zero-shot column inference (timestamp vs. concentration)  │
  │  - Datetime convention, ISO offset, and UTC detection        │
  │  - Concentration unit extraction (µg/m³ vs. mg/m³)           │
  │  - Compiles into explicit, reproducible CsvMapping JSON      │
  └─────────────────────────────┬────────────────────────────────┘
                                │ Normalized Canonical CSV
                                ▼
  ════════════════════════════════════════════════════════════════
   DETERMINISTIC CRYPTOGRAPHIC CORE (ZERO AI / STRICT INTEGRITY)
    • Exact UTC schedule matching: [windowStart, windowEnd)
    • Expected hour diffing: expected.difference(observed)
    • Physical sanity checks: non-negative PM2.5 rule
    • Canonical Keccak-256 hashes (seriesHash, gapHash, policyHash)
    • Ethereum Sepolia commitment contract & revert guards
  ════════════════════════════════════════════════════════════════
                                │ Verified Evidence Package
                                ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  LAYER 2: OMISSION PATTERN ATTRIBUTION (Time-Series ML)      │
  │  - Classifies omission signatures:                           │
  │    • Isolated Telemetry Dropout (transient network loss)     │
  │    • Extended Station Outage (power / hardware maintenance)  │
  │    • Selective Peak Omission (diurnal peak suppression)      │
  ├──────────────────────────────────────────────────────────────┤
  │  LAYER 3: COUNTERFACTUAL IMPUTATION (Statistical ML)         │
  │  - Bounded expectation of what missing hours likely measured │
  │  - Estimates aggregate mean distortion (-8.9% suppressed)    │
  │  - Explicitly labeled: NOT committed on-chain                │
  ├──────────────────────────────────────────────────────────────┤
  │  LAYER 4: EXECUTIVE REGULATORY COPILOT (Generative NLP)      │
  │  - Translates hexadecimal hashes and ABI revert errors       │
  │    into plain-language executive compliance audit briefs     │
  └──────────────────────────────────────────────────────────────┘
```

---

## 2. Four Layers of AI Assistance

### Layer 1: Intelligent Pre-Ingest & Schema Inference (`inferCsvSchema`)
* **Problem:** Municipal monitoring stations and community sensors export erratic spreadsheets with non-standard column names (`Date_Time_Local`, `PM25_ENV`), missing headers, local timezone offsets, or mixed units ($\text{mg/m}^3$ vs. $\mu\text{g/m}^3$).
* **Implementation:** `web/src/lib/ai-analysis.ts` (`inferCsvSchema`)
* **Mechanism:** Inspects headers and sample rows using pattern recognition to auto-select columns, detect ISO offsets versus naive UTC, and detect unit multipliers.
* **Epistemic Safeguard:** The AI proposes the mapping; the human reviewer reviews and approves it; the conversion executes via strict deterministic TypeScript code (`normalizeCsv`), recording exact `originalHash` and `normalizedHash`.

### Layer 2: Omission Pattern Attribution (`analyzeOmissionPattern`)
* **Problem:** Proving that hours are missing does not explain *why* they are missing. A reviewer needs to distinguish between a routine nighttime communication blip and suspicious omission during peak industrial activity.
* **Implementation:** `web/src/lib/ai-analysis.ts` and `scripts/ai_copilot.py` (`analyze_copilot`)
* **Classification Taxonomy:**
  1. `COMPLETE_RECORD`: 100% temporal completeness confirmed.
  2. `ISOLATED_TELEMETRY_DROPOUT`: 1–2 isolated missing hours across short runs (Low suspicion; typical transient network timeout).
  3. `EXTENDED_STATION_OUTAGE`: $\ge 12$ continuous hours spanning day and night (Moderate suspicion; characteristic of power outages or scheduled maintenance).
  4. `SELECTIVE_PEAK_OMISSION`: 3+ continuous hours missing predominantly ($\ge 70\%$) during daytime peak exposure hours (Elevated suspicion; artificially deflates daily exposure averages).
  5. `IMPOSSIBLE_PHYSICAL_MEASUREMENT`: Negative PM2.5 readings (High suspicion; optical sensor failure or zero-point drift).

### Layer 3: Counterfactual Imputation Estimation (`estimateCounterfactual`)
* **Problem:** When an entity deletes 7 hours from a 24-hour file (as in the frozen File A demo), the apparent mean drops by 8.87%. Regulators need to know the counterfactual: *What was the real pollution level likely to be?*
* **Implementation:** `web/src/lib/ai-analysis.ts` (`estimateCounterfactual`)
* **Mechanism:** Computes bounded boundary interpolation across missing intervals using the neighboring observations and diurnal trends. Calculates the expected complete mean and aggregate distortion percentage.
* **Epistemic Safeguard:** Labeled prominently as:
  > *"Statistical counterfactual estimation for reviewer impact assessment. Non-deterministic, unobserved, and NOT committed on-chain."*

### Layer 4: Executive Regulatory Auditor Copilot (`generateAuditNarrative`)
* **Problem:** Judges, policymakers, and community advocates do not read raw Keccak-256 hashes, JSON delta trees, or EVM revert selectors like `GapPaperedOver`.
* **Implementation:** `web/src/lib/ai-analysis.ts` (`generateAuditNarrative`)
* **Mechanism:** Synthesizes the completeness audit, AI anomaly attribution, counterfactual impact, and on-chain cryptographic commitment into a standardized **Executive Compliance Brief**.
* **Export:** One-click download from the Reviewer Workspace (`gapwitness-executive-brief.txt`) and automatic embedding in the printable PDF/HTML audit report.

---

## 3. Epistemic Boundary Summary

| Feature | Deterministic Core | AI Assistance Layer |
| :--- | :---: | :---: |
| **Output Type** | Exact mathematical proof / Keccak-256 | Empirical heuristic / Bounded estimate |
| **Reproducibility** | Bit-for-bit identical across all machines | Bounded statistical model |
| **On-Chain Commitment** | Committed to Sepolia contract storage | Never committed on-chain |
| **Legal Status** | Court-admissible cryptographic evidence | Reviewer exploratory advisory |

---

## 4. Verification and Execution

### Browser UI
1. **Schema Auto-Detection:** Navigate to `/inspect`, upload an unmapped CSV, and click **"✨ AI Auto-Detect Mapping"**.
2. **Anomaly Attribution & Counterfactuals:** Navigate to `/review` after inspecting File A to view the **AI Anomaly Attribution** card and **Counterfactual Impact** metrics.
3. **Executive Brief:** In `/review`, click **"download AI compliance brief"** to export the synthesized auditor memo.

### Command-Line Execution
Run the Python AI Copilot directly on any environmental dataset:

```bash
python scripts/ai_copilot.py checker/demo/file_a.csv \
  --station-id 2178 \
  --window-start 2026-09-19T07:00:00Z \
  --window-end 2026-09-20T07:00:00Z
```

### Automated Tests
```bash
# Frontend AI analysis and schema tests
cd web && npm test

# Python AI copilot tests
pytest scripts/test_ai_copilot.py -q
```
