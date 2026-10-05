from app.main import inspect_csv, canonical_gap_text, canonical_gap_hash, series_hash

START="2026-01-01T00:00:00Z"
END="2026-01-01T10:00:00Z"

def csv(rows): return ("timestamp,value\n" + rows).encode()

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
    assert r["verdict"]=="IMPOSSIBLE"

def test_window_is_independent_of_rows():
    r=inspect_csv(csv("2026-01-01T02:00:00Z,10\n"),station_id="demo",window_start=START,window_end="2026-01-01T04:00:00Z")
    assert r["verdict"]=="GAPPED" and len(r["missingTimestamps"])==1

def test_duplicate_timestamp_rejected():
    try: inspect_csv(csv("2026-01-01T00:00:00Z,1\n2026-01-01T00:00:00Z,2\n"),station_id="demo",window_start=START,window_end="2026-01-01T01:00:00Z")
    except ValueError as exc: assert str(exc)=="DUPLICATE_TIMESTAMP"
    else: raise AssertionError("duplicate timestamps must fail")

def test_gap_canonicalization_is_order_independent():
    a=["2026-01-01T03:00:00Z","2026-01-01T01:00:00Z"]
    b=list(reversed(a))
    assert canonical_gap_text(a)==canonical_gap_text(b)
    assert canonical_gap_hash(a)==canonical_gap_hash(b)

def test_hashes_are_exposed():
    payload=csv("2026-01-01T00:00:00Z,1\n")
    r=inspect_csv(payload,station_id="demo",window_start=START,window_end="2026-01-01T01:00:00Z")
    assert r["seriesHashSha3"]==series_hash(payload)
    assert r["gapHashSha3"]==canonical_gap_hash(r["missingTimestamps"])
