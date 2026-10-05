from __future__ import annotations
from io import BytesIO
import pandas as pd
from Crypto.Hash import keccak
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

app = FastAPI(title="GapWitness Checker", version="0.4.0")
MAX_FILE_BYTES = 1_000_000
MAX_WINDOW_HOURS = 24 * 31
POLICY_VERSION = "gapwitness/pm25/hourly/v1"

def keccak256(data: bytes) -> str:
    h = keccak.new(digest_bits=256)
    h.update(data)
    return h.hexdigest()

def canonical_gap_text(gaps: list[str]) -> str:
    return "\n".join(sorted(gaps))

def canonical_gap_hash(gaps: list[str]) -> str:
    return keccak256(canonical_gap_text(gaps).encode())

def series_hash(csv_bytes: bytes) -> str:
    return keccak256(csv_bytes)

def policy_hash(series_type: str) -> str:
    if series_type == "pm25":
        return keccak256(POLICY_VERSION.encode())
    if series_type == "generic":
        return keccak256(b"gapwitness/generic/hourly/v1")
    raise ValueError("UNSUPPORTED_SERIES_TYPE")

def verdict_code(verdict: str) -> int:
    return {"INTACT": 0, "GAPPED": 1, "IMPOSSIBLE": 2}[verdict]

def _utc(value: str) -> pd.Timestamp:
    ts = pd.to_datetime(value, utc=True, errors="raise")
    if pd.isna(ts):
        raise ValueError("INVALID_TIMESTAMP")
    return ts

def inspect_csv(csv_bytes: bytes, *, station_id: str, window_start: str, window_end: str, series_type: str = "pm25") -> dict:
    if not csv_bytes:
        raise ValueError("EMPTY_FILE")
    if len(csv_bytes) > MAX_FILE_BYTES:
        raise ValueError("FILE_TOO_LARGE")
    start, end = _utc(window_start), _utc(window_end)
    if start.minute or start.second or start.microsecond or end.minute or end.second or end.microsecond:
        raise ValueError("WINDOW_MUST_ALIGN_TO_HOUR")
    if end <= start:
        raise ValueError("INVALID_WINDOW")
    expected = pd.date_range(start=start, end=end, freq="1h", inclusive="left", tz="UTC")
    if len(expected) > MAX_WINDOW_HOURS:
        raise ValueError("WINDOW_TOO_WIDE")
    try:
        df = pd.read_csv(BytesIO(csv_bytes))
    except Exception as exc:
        raise ValueError(f"INVALID_CSV: {exc}") from exc
    missing_columns = sorted({"timestamp", "value"} - set(df.columns))
    if missing_columns:
        raise ValueError("MISSING_COLUMNS: " + ",".join(missing_columns))
    if df.empty:
        raise ValueError("EMPTY_SERIES")
    timestamps = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    if timestamps.isna().any():
        raise ValueError("INVALID_TIMESTAMP")
    if timestamps.duplicated().any():
        raise ValueError("DUPLICATE_TIMESTAMP")
    values = pd.to_numeric(df["value"], errors="coerce")
    if values.isna().any():
        raise ValueError("INVALID_VALUE")
    in_window = (timestamps >= start) & (timestamps < end)
    observed = pd.DatetimeIndex(timestamps[in_window])
    missing = expected.difference(observed).sort_values()
    impossible: list[str] = []
    if series_type == "pm25":
        impossible = [
            ts.isoformat().replace("+00:00", "Z")
            for ts in timestamps[in_window][values[in_window] < 0]
        ]
    elif series_type != "generic":
        raise ValueError("UNSUPPORTED_SERIES_TYPE")
    gaps = [ts.isoformat().replace("+00:00", "Z") for ts in missing]
    verdict = "IMPOSSIBLE" if impossible else ("GAPPED" if gaps else "INTACT")
    return {
        "stationId": station_id,
        "windowStart": start.isoformat().replace("+00:00", "Z"),
        "windowEnd": end.isoformat().replace("+00:00", "Z"),
        "seriesType": series_type,
        "expectedHours": len(expected),
        "observedHours": len(observed),
        "missingTimestamps": gaps,
        "materialGap": len(gaps) > 2,
        "impossibleTimestamps": impossible,
        "verdict": verdict,
        "verdictCode": verdict_code(verdict),
        "seriesHash": "0x" + series_hash(csv_bytes),
        "gapHash": "0x" + canonical_gap_hash(gaps),
        "policyHash": "0x" + policy_hash(series_type),
        "chainCommitment": {
            "stationId": station_id,
            "windowStart": int(start.timestamp()),
            "windowEnd": int(end.timestamp()),
            "seriesHash": "0x" + series_hash(csv_bytes),
            "gapHash": "0x" + canonical_gap_hash(gaps),
            "policyHash": "0x" + policy_hash(series_type),
            "verdict": verdict_code(verdict),
        },
    }

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/inspect")
async def inspect(
    stationId: str = Form(...),
    windowStart: str = Form(...),
    windowEnd: str = Form(...),
    seriesType: str = Form("pm25"),
    csv: UploadFile = File(...),
):
    try:
        return inspect_csv(
            await csv.read(),
            station_id=stationId,
            window_start=windowStart,
            window_end=windowEnd,
            series_type=seriesType,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
