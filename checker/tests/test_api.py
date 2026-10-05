from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import MAX_FILE_BYTES, app, rate_limiter

client = TestClient(app)


def setup_function() -> None:
    rate_limiter._hits.clear()


def csv_payload(rows: str) -> bytes:
    return ("timestamp,value\n" + rows).encode()


def form_data() -> dict[str, str]:
    return {
        "stationId": "demo",
        "windowStart": "2026-01-01T00:00:00Z",
        "windowEnd": "2026-01-01T01:00:00Z",
        "seriesType": "pm25",
    }


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "service": "gapwitness-checker",
        "version": app.version,
    }


def test_inspect_endpoint_returns_chain_ready_evidence() -> None:
    response = client.post(
        "/inspect",
        data=form_data(),
        files={
            "csv": (
                "sample.csv",
                csv_payload("2026-01-01T00:00:00Z,12.4\n"),
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["stationId"] == "demo"
    assert body["verdict"] == "INTACT"
    assert body["observedHours"] == 1
    assert body["missingTimestamps"] == []
    assert body["chainCommitment"]["verdict"] == 0


def test_inspect_rejects_non_csv_filename() -> None:
    response = client.post(
        "/inspect",
        data=form_data(),
        files={"csv": ("sample.txt", b"timestamp,value\n", "text/plain")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "INVALID_FILE_TYPE"


def test_inspect_streams_and_rejects_oversized_upload() -> None:
    payload = b"x" * (MAX_FILE_BYTES + 1)
    response = client.post(
        "/inspect",
        data=form_data(),
        files={"csv": ("sample.csv", payload, "text/csv")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "FILE_TOO_LARGE"


def test_inspect_rejects_missing_columns() -> None:
    response = client.post(
        "/inspect",
        data=form_data(),
        files={"csv": ("sample.csv", b"foo,bar\n1,2\n", "text/csv")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "MISSING_COLUMNS: timestamp,value"


def test_inspect_rate_limits_by_client() -> None:
    rate_limiter.limit = 1
    try:
        first = client.post(
            "/inspect",
            data=form_data(),
            files={"csv": ("sample.csv", csv_payload("2026-01-01T00:00:00Z,1\n"), "text/csv")},
        )
        second = client.post(
            "/inspect",
            data=form_data(),
            files={"csv": ("sample.csv", csv_payload("2026-01-01T00:00:00Z,1\n"), "text/csv")},
        )
    finally:
        rate_limiter.limit = 30

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["detail"] == "RATE_LIMITED"
    assert second.headers["retry-after"] == "60"


def test_cors_is_locked_to_configured_origin() -> None:
    allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
    denied = client.get("/health", headers={"Origin": "https://evil.example"})

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers
