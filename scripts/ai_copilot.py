"""AI Reviewer Copilot and Anomaly Attribution Engine.
Analyzes temporal omissions, classifies omission patterns (telemetry vs selective peak pruning),
estimates bounded counterfactual exposure, and generates executive compliance briefs.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, timedelta
import json
import math
from pathlib import Path


def parse_iso(ts_str: str) -> datetime:
    cleaned = ts_str.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(cleaned)
    return dt.astimezone(timezone.utc)


def analyze_copilot(
    observations: list[dict[str, float]],
    missing_timestamps: list[str],
    station_id: str,
    window_start: str,
    window_end: str,
    series_type: str = "pm25",
) -> dict:
    expected_start = parse_iso(window_start)
    expected_end = parse_iso(window_end)
    expected_hours = int((expected_end - expected_start).total_seconds() // 3600)
    observed_hours = len(observations)

    # 1. Physical violations check
    impossible = [o["timestamp"] for o in observations if o["value"] < 0] if series_type == "pm25" else []

    # 2. Pattern attribution
    gaps_dt = [parse_iso(ts) for ts in missing_timestamps]
    gaps_dt.sort()

    runs: list[list[datetime]] = []
    for dt in gaps_dt:
        if runs and (dt - runs[-1][-1]).total_seconds() == 3600:
            runs[-1].append(dt)
        else:
            runs.append([dt])

    longest_run = max((len(r) for r in runs), default=0)
    run_count = len(runs)

    # Diurnal peak hours (07:00 to 21:00 UTC)
    peak_gaps = sum(1 for dt in gaps_dt if 7 <= dt.hour <= 21)
    peak_fraction = (peak_gaps / len(gaps_dt)) if gaps_dt else 0.0

    if impossible:
        category = "IMPOSSIBLE_PHYSICAL_MEASUREMENT"
        category_label = "Physical Sanity Violation (Negative PM2.5)"
        suspicion = "HIGH"
        confidence = 99
        rationale = f"{len(impossible)} observations violate the non-negative rule. Indicates sensor zero-point drift or electrical failure."
    elif not missing_timestamps:
        category = "COMPLETE_RECORD"
        category_label = "Temporal Completeness Passed"
        suspicion = "LOW"
        confidence = 100
        rationale = "Every expected observation within the declared window is present and finite."
    elif longest_run <= 2 and run_count <= 2:
        category = "ISOLATED_TELEMETRY_DROPOUT"
        category_label = "Isolated Telemetry Dropout"
        suspicion = "LOW"
        confidence = 88
        rationale = f"{len(missing_timestamps)} isolated missing hours across {run_count} short runs. Typical of transient network timeout."
    elif longest_run >= 12:
        category = "EXTENDED_STATION_OUTAGE"
        category_label = "Extended Station Outage"
        suspicion = "MODERATE"
        confidence = 92
        rationale = f"Sustained omission of {longest_run} continuous hours spanning day and night. Characteristic of prolonged power failure or hardware replacement."
    elif longest_run >= 3 and peak_fraction >= 0.7:
        category = "SELECTIVE_PEAK_OMISSION"
        category_label = "Selective Peak-Period Omission"
        suspicion = "ELEVATED"
        confidence = 86
        rationale = f"{len(missing_timestamps)} missing hours clustered predominantly ({round(peak_fraction * 100)}%) during peak daytime exposure hours (longest run: {longest_run}h). Deflates apparent daily exposure average."
    else:
        category = "MULTI_HOUR_INTERMITTENT_OMISSION"
        category_label = "Multi-Hour Intermittent Omission"
        suspicion = "MODERATE"
        confidence = 78
        rationale = f"{len(missing_timestamps)} missing hours across {run_count} separate intervals. Review station maintenance log."

    # 3. Counterfactual estimation
    counterfactual = None
    if observations and missing_timestamps:
        values = [o["value"] for o in observations]
        obs_mean = sum(values) / len(values)
        obs_map = {parse_iso(o["timestamp"]): o["value"] for o in observations}

        imputed_sum = 0.0
        for dt in gaps_dt:
            prev_val = next((obs_map[dt - timedelta(hours=i)] for i in range(1, 25) if (dt - timedelta(hours=i)) in obs_map), None)
            next_val = next((obs_map[dt + timedelta(hours=i)] for i in range(1, 25) if (dt + timedelta(hours=i)) in obs_map), None)

            if prev_val is not None and next_val is not None:
                est = (prev_val + next_val) / 2.0
            elif prev_val is not None:
                est = prev_val
            elif next_val is not None:
                est = next_val
            else:
                est = obs_mean
            imputed_sum += est

        cf_mean = (sum(values) + imputed_sum) / expected_hours
        distortion_pct = ((obs_mean - cf_mean) / cf_mean * 100.0) if cf_mean > 0 else 0.0
        direction = "neutral" if abs(distortion_pct) < 0.5 else ("suppressed" if distortion_pct < 0 else "elevated")

        counterfactual = {
            "observedMean": round(obs_mean, 4),
            "counterfactualMean": round(cf_mean, 4),
            "estimatedDistortionPercent": round(distortion_pct, 2),
            "distortionDirection": direction,
            "bounds": {
                "minEstimate": round((sum(values) + imputed_sum * 0.85) / expected_hours, 4),
                "maxEstimate": round((sum(values) + imputed_sum * 1.15) / expected_hours, 4),
            },
            "epistemicBoundary": "Statistical counterfactual estimation for reviewer impact assessment. Non-deterministic, unobserved, and NOT committed on-chain.",
        }

    return {
        "format": "gapwitness/ai-copilot/v1",
        "stationId": station_id,
        "window": {"start": window_start, "end": window_end, "expectedHours": expected_hours, "observedHours": observed_hours},
        "attribution": {
            "category": category,
            "categoryLabel": category_label,
            "suspicionLevel": suspicion,
            "confidencePercent": confidence,
            "longestRunHours": longest_run,
            "runCount": run_count,
            "peakHourFraction": round(peak_fraction, 2),
            "rationale": rationale,
            "epistemicNote": "Attribution is an empirical heuristic aid. It does not establish legal intent or equipment malfunction.",
        },
        "counterfactual": counterfactual,
    }


def main() -> int:
    import csv

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="CSV file to analyze")
    parser.add_argument("--station-id", default="2178")
    parser.add_argument("--window-start", default="2026-09-19T07:00:00Z")
    parser.add_argument("--window-end", default="2026-09-20T07:00:00Z")
    parser.add_argument("--series-type", default="pm25")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    with args.csv.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    observations = [{"timestamp": r["timestamp"].strip(), "value": float(r["value"])} for r in rows if r.get("timestamp") and r.get("value")]

    start_dt = parse_iso(args.window_start)
    end_dt = parse_iso(args.window_end)
    expected_hours = int((end_dt - start_dt).total_seconds() // 3600)

    from datetime import timedelta
    expected = [start_dt + timedelta(hours=i) for i in range(expected_hours)]
    observed_dts = {parse_iso(o["timestamp"]) for o in observations}
    missing = [dt.isoformat().replace("+00:00", "Z") for dt in expected if dt not in observed_dts]

    result = analyze_copilot(observations, missing, args.station_id, args.window_start, args.window_end, args.series_type)

    formatted = json.dumps(result, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(formatted + "\n")
    print(formatted)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
