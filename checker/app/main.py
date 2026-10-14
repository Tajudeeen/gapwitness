from __future__ import annotations

from collections import deque
from io import BytesIO
import csv as csv_module
from io import StringIO
import os
import math
import time

import pandas as pd
from Crypto.Hash import keccak
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="GapWitness Checker", version="0.7.0")

MAX_FILE_BYTES = 1_000_000
MAX_WINDOW_HOURS = 24 * 31
MAX_REQUEST_BYTES = 1_100_000
MAX_RATE_CLIENTS = 10_000
POLICY_VERSION = "gapwitness/pm25/hourly/v1"


def _env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc


WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:5173").strip().rstrip("/")
INSPECT_RATE_LIMIT = _env_int("INSPECT_RATE_LIMIT", 30)
INSPECT_RATE_WINDOW_SECONDS = _env_int("INSPECT_RATE_WINDOW_SECONDS", 60)


if WEB_ORIGIN == "*":
    raise RuntimeError("WEB_ORIGIN must be a single trusted origin, not '*'")


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, now: float | None = None) -> bool:
        current = time.monotonic() if now is None else now
        cutoff = current - self.window_seconds

        if key not in self._hits and len(self._hits) >= MAX_RATE_CLIENTS:
            stale = [stored_key for stored_key, stored_hits in self._hits.items()
                     if not stored_hits or stored_hits[-1] <= cutoff]
            for stored_key in stale:
                self._hits.pop(stored_key, None)
            if len(self._hits) >= MAX_RATE_CLIENTS:
                return False
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= cutoff:
            hits.popleft()

        if len(hits) >= self.limit:
            return False

        hits.append(current)
        if len(self._hits) > 10_000:
            stale = [
                stored_key
                for stored_key, stored_hits in self._hits.items()
                if not stored_hits or stored_hits[-1] <= cutoff
            ]
            for stored_key in stale:
                self._hits.pop(stored_key, None)
        return True


rate_limiter = RateLimiter(INSPECT_RATE_LIMIT, INSPECT_RATE_WINDOW_SECONDS)


class InspectionBodyLimit:
    """Bound and rate-limit the request before multipart parsing or spooling."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] != "/inspect":
            return await self.app(scope, receive, send)
        client = scope.get("client")
        if not rate_limiter.allow(client[0] if client else "unknown"):
            return await JSONResponse({"detail": "RATE_LIMITED"}, status_code=429,
                headers={"Retry-After": str(INSPECT_RATE_WINDOW_SECONDS)})(scope, receive, send)
        messages, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            total += len(message.get("body", b""))
            if total > MAX_REQUEST_BYTES:
                return await JSONResponse({"detail": "REQUEST_TOO_LARGE"}, status_code=413)(scope, receive, send)
            messages.append(message)
            if not message.get("more_body", False):
                break
        index = 0
        async def bounded_receive():
            nonlocal index
            if index < len(messages):
                message = messages[index]
                index += 1
                return message
            return await receive()
        await self.app(scope, bounded_receive, send)


app.add_middleware(InspectionBodyLimit)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEB_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


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


def inspect_csv(
    csv_bytes: bytes,
    *,
    station_id: str,
    window_start: str,
    window_end: str,
    series_type: str = "pm25",
) -> dict:
    if not station_id or len(station_id.encode("utf-8")) > 31 or "\x00" in station_id:
        raise ValueError("INVALID_STATION_ID")
    if not csv_bytes:
        raise ValueError("EMPTY_FILE")
    if len(csv_bytes) > MAX_FILE_BYTES:
        raise ValueError("FILE_TOO_LARGE")

    start, end = _utc(window_start), _utc(window_end)
    if (
        start.minute
        or start.second
        or start.microsecond
        or start.nanosecond
        or end.minute
        or end.second
        or end.microsecond
        or end.nanosecond
    ):
        raise ValueError("WINDOW_MUST_ALIGN_TO_HOUR")
    if end <= start:
        raise ValueError("INVALID_WINDOW")

    if end - start > pd.Timedelta(hours=MAX_WINDOW_HOURS):
        raise ValueError("WINDOW_TOO_WIDE")
    if start.timestamp() < 0:
        raise ValueError("WINDOW_BEFORE_UNIX_EPOCH")

    expected = pd.date_range(
        start=start,
        end=end,
        freq="1h",
        inclusive="left",
        tz="UTC",
    )
    if len(expected) > MAX_WINDOW_HOURS:
        raise ValueError("WINDOW_TOO_WIDE")

    try:
        rows = [row for row in csv_module.reader(StringIO(csv_bytes.decode("utf-8-sig")), strict=True)
                if any(field.strip() for field in row)]
        if not rows:
            raise ValueError("EMPTY_SERIES")
        header = rows[0]
        if len(set(header)) != len(header):
            raise ValueError("DUPLICATE_COLUMNS")
        if any(len(row) != len(header) for row in rows[1:]):
            raise ValueError("INCONSISTENT_CSV_COLUMNS")
        df = pd.read_csv(BytesIO(csv_bytes))
    except ValueError as exc:
        if str(exc) in ("EMPTY_SERIES", "DUPLICATE_COLUMNS", "INCONSISTENT_CSV_COLUMNS"):
            raise
        raise ValueError("INVALID_CSV") from exc
    except Exception as exc:
        raise ValueError("INVALID_CSV") from exc

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

    if (timestamps != timestamps.dt.floor("h")).any():
        raise ValueError("TIMESTAMP_MUST_ALIGN_TO_HOUR")

    values = pd.to_numeric(df["value"], errors="coerce")
    if values.isna().any() or not values.map(math.isfinite).all():
        raise ValueError("INVALID_VALUE")

    in_window = (timestamps >= start) & (timestamps < end)
    observed = pd.DatetimeIndex(timestamps[in_window])
    if observed.empty:
        raise ValueError("NO_OBSERVATIONS_IN_WINDOW")
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
        "observations": sorted(
            [
                {"timestamp": ts.isoformat().replace("+00:00", "Z"), "value": float(value)}
                for ts, value in zip(timestamps[in_window], values[in_window])
            ],
            key=lambda observation: observation["timestamp"],
        ),
        "missingTimestamps": gaps,
        "materialGap": len(gaps) > 2,
        "impossibleTimestamps": sorted(impossible),
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


async def _read_limited(upload: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    chunk_size = 64 * 1024

    while True:
        chunk = await upload.read(chunk_size)
        if not chunk:
            break

        total += len(chunk)
        if total > MAX_FILE_BYTES:
            raise ValueError("FILE_TOO_LARGE")
        chunks.append(chunk)

    return b"".join(chunks)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "gapwitness-checker",
        "version": app.version,
    }


@app.post("/inspect")
async def inspect(
    request: Request,
    stationId: str = Form(...),
    windowStart: str = Form(...),
    windowEnd: str = Form(...),
    seriesType: str = Form("pm25"),
    csv: UploadFile = File(...),
) -> dict:
    if not csv.filename or not csv.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="INVALID_FILE_TYPE")

    try:
        payload = await _read_limited(csv)
        return await run_in_threadpool(inspect_csv,
            payload,
            station_id=stationId.strip(),
            window_start=windowStart,
            window_end=windowEnd,
            series_type=seriesType.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
