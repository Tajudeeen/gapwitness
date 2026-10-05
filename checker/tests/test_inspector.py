from Crypto.Hash import keccak
from app.main import inspect_csv, canonical_gap_text, canonical_gap_hash, policy_hash, series_hash

START="2026-01-01T00:00:00Z"
END="2026-01-01T10:00:00Z"

def csv(rows): return ("timestamp,value\n" + rows).encode()

def expected_keccak(payload: bytes) -> str:
    h=keccak.new(digest_bits=256)
    h.update(payload)
    return h.hexdigest()

def test_intact():
    rows="".join(f"2026-01-01T{i:02d}:00:00Z,{10+i}\n" for i in range(10))
    r=inspect_csv(csv(rows),station_id="demo",window_start=START,window_end=END)
    assert r["verdict"]=="INTACT" and r["missingTimestamps"]==[]

def test_seven_hour_gap():
    rows="".join(f"2026-01-01T{i:02d}:00:00Z,{10+i}\n" for i in [0,8,9])
    r=inspect_csv(csv(rows),station_id="demo",window_start=START,window_end=END)
    assert r["verdict"]=="GAPPED" and len(r["missingTimestamps"])==7 and r["materialGap"]

def test_negative_pm25_is_impossible():
    r=inspect_csv(csv("2026-01-01T00:00:00Z,-1\n"),station_id="demo",window_start=START,window_end="2026-01-01T01:00:00Z")
    assert r["verdict"]=="IMPOSSIBLE" and r["verdictCode"]==2

def test_window_is_independent_of_rows():
    r=inspect_csv(
        csv("2026-01-01T02:00:00Z,10\n"),
        station_id="demo",
        window_start=START,
        window_end="2026-01-01T04:00:00Z",
    )
    assert r["verdict"] == "GAPPED"
    assert r["missingTimestamps"] == [
        "2026-01-01T00:00:00Z",
        "2026-01-01T01:00:00Z",
        "2026-01-01T03:00:00Z",
    ]

def test_duplicate_timestamp_rejected():
    try: inspect_csv(csv("2026-01-01T00:00:00Z,1\n2026-01-01T00:00:00Z,2\n"),station_id="demo",window_start=START,window_end="2026-01-01T01:00:00Z")
    except ValueError as exc: assert str(exc)=="DUPLICATE_TIMESTAMP"
    else: raise AssertionError("duplicate timestamps must fail")

def test_gap_canonicalization_is_order_independent():
    a=["2026-01-01T03:00:00Z","2026-01-01T01:00:00Z"]
    b=list(reversed(a))
    assert canonical_gap_text(a)==canonical_gap_text(b)
    assert canonical_gap_hash(a)==canonical_gap_hash(b)

def test_hashes_match_ethereum_keccak():
    payload=csv("2026-01-01T00:00:00Z,1\n")
    r=inspect_csv(payload,station_id="demo",window_start=START,window_end="2026-01-01T01:00:00Z")
    assert r["seriesHash"]=="0x"+expected_keccak(payload)
    assert r["gapHash"]=="0x"+expected_keccak(b"")
    assert r["policyHash"]=="0x"+expected_keccak(b"gapwitness/pm25/hourly/v1")
    assert series_hash(payload)==expected_keccak(payload)
    assert canonical_gap_hash([])==expected_keccak(b"")

def test_chain_commitment_matches_top_level_evidence():
    payload=csv("2026-01-01T00:00:00Z,1\n")
    r=inspect_csv(payload,station_id="demo",window_start=START,window_end="2026-01-01T01:00:00Z")
    c=r["chainCommitment"]
    assert c["stationId"]=="demo"
    assert c["windowStart"]==1767225600
    assert c["windowEnd"]==1767229200
    assert c["seriesHash"]==r["seriesHash"]
    assert c["gapHash"]==r["gapHash"]
    assert c["policyHash"]==r["policyHash"]
    assert c["verdict"]==r["verdictCode"]

def test_window_must_align_to_hour():
    try:
        inspect_csv(csv("2026-01-01T00:30:00Z,1\n"),station_id="demo",window_start="2026-01-01T00:30:00Z",window_end="2026-01-01T02:00:00Z")
    except ValueError as exc: assert str(exc)=="WINDOW_MUST_ALIGN_TO_HOUR"
    else: raise AssertionError("unaligned windows must fail")
