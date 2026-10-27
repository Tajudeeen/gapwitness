"""Deterministic review brief. Historical filename retained for existing commands; no AI inference."""
from __future__ import annotations
import argparse
import csv
import io
import json
import math
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"checker"))
from app.main import inspect_csv


def analyze_result(evidence, threshold=3.1):
    if not math.isfinite(threshold) or threshold < 0:
        raise ValueError("Threshold must be finite and non-negative")
    from datetime import datetime
    gaps=sorted(datetime.fromisoformat(t.replace("Z","+00:00")) for t in evidence["missingTimestamps"])
    longest=run=runs=0
    previous=None
    for dt in gaps:
        if previous is not None and (dt-previous).total_seconds()==3600: run+=1
        else: run=1; runs+=1
        longest=max(longest,run);previous=dt
    invalid=evidence["seriesType"]!="pm25" or bool(evidence["impossibleTimestamps"])
    total=sum(o["value"] for o in evidence["observations"])
    lower=total/evidence["expectedHours"]
    status="UNRESOLVED" if invalid else "NOT_SUPPORTED" if lower>threshold else "UNRESOLVED" if gaps else "SUPPORTED"
    return {"format":"gapwitness/review-brief/v2","stationId":evidence["stationId"],
        "window":{"start":evidence["windowStart"],"end":evidence["windowEnd"]},
        "description":{"missingHours":len(gaps),"runCount":runs,"longestRunHours":longest,
            "note":"Descriptive rules only; timing does not establish cause, confidence or intent."},
        "decision":{"claim":"Full-window arithmetic mean at most threshold","threshold":threshold,"status":status,
            "availableMean":total/evidence["observedHours"],"lowerMean":None if invalid else lower,
            "upperMean":None if invalid or gaps else lower},
        "seriesHash":evidence["seriesHash"],
        "limits":["Conditional on the declared schedule and non-negative PM2.5 policy.",
            "Null upper bound is unbounded or unavailable, not zero. No missing measurement is reconstructed.",
            "No source authentication, regulatory acceptance or environmental outcome is established."]}


def analyze_copilot(observations,missing_timestamps,station_id,window_start,window_end,series_type="pm25",threshold=3.1):
    output=io.StringIO();writer=csv.writer(output);writer.writerow(["timestamp","value"])
    for o in observations:writer.writerow([o["timestamp"],o["value"]])
    evidence=inspect_csv(output.getvalue().encode(),station_id=station_id,window_start=window_start,window_end=window_end,series_type=series_type)
    if sorted(missing_timestamps)!=evidence["missingTimestamps"]:raise ValueError("Provided gaps do not match the declared schedule and observations")
    return analyze_result(evidence,threshold)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("csv",type=Path)
    parser.add_argument("--station-id",default="2178");parser.add_argument("--window-start",default="2026-09-19T07:00:00Z")
    parser.add_argument("--window-end",default="2026-09-20T07:00:00Z");parser.add_argument("--series-type",default="pm25")
    parser.add_argument("--threshold",type=float,default=3.1);parser.add_argument("--output",type=Path)
    args=parser.parse_args();evidence=inspect_csv(args.csv.read_bytes(),station_id=args.station_id,window_start=args.window_start,window_end=args.window_end,series_type=args.series_type)
    text=json.dumps(analyze_result(evidence,args.threshold),indent=2)+"\n"
    if args.output:args.output.write_text(text)
    print(text,end="")
if __name__=="__main__":main()
