"""Check a real deployed release without a wallet, secrets, or invented external evidence."""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from check_submission import submission_gaps

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'checker'))
from app.main import inspect_csv
from verify_real_corpus import verify as verify_corpus

ROUTES = ['', '/inspect', '/review', '/evidence', '/publish', '/verify', '/datasets', '/pilot', '/status']


def fetch(url: str, data: bytes | None = None, headers: dict | None = None) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=data, headers={'User-Agent': 'GapWitnessRelease/1.0'} | (headers or {}))
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.status, response.read(2_000_000)


def inspect_fixture(base: str, name: str) -> dict:
    payload = (ROOT / 'checker/demo' / name).read_bytes()
    context = {'stationId': '2178', 'windowStart': '2026-09-19T07:00:00Z', 'windowEnd': '2026-09-20T07:00:00Z', 'seriesType': 'pm25'}
    boundary = 'GapWitness' + uuid.uuid4().hex
    chunks = []
    for key, value in context.items():
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    chunks.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="csv"; filename="{name}"\r\nContent-Type: text/csv\r\n\r\n'.encode(), payload, f'\r\n--{boundary}--\r\n'.encode()])
    status, body = fetch(base + '/inspect', b''.join(chunks), {'Content-Type': 'multipart/form-data; boundary=' + boundary})
    actual = json.loads(body)
    expected = inspect_csv(payload, station_id=context['stationId'], window_start=context['windowStart'], window_end=context['windowEnd'])
    if actual != expected:
        raise ValueError('Deployed evidence differs from the retained CSV recomputation')
    return {'httpStatus': status, 'verdict': actual['verdict'], 'observedHours': actual['observedHours'], 'expectedHours': actual['expectedHours'], 'missingHours': len(actual['missingTimestamps']), 'allEvidenceFieldsMatched': True}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-url', default='https://gapwitness-web.vercel.app')
    parser.add_argument('--checker-url', default='https://gapwitness-checker.vercel.app')
    parser.add_argument('--expect-commit', help='Fail unless release.json identifies this exact deployed 40-character Git SHA.')
    parser.add_argument('--require-shared', action='store_true', help='Fail unless the live checker reports shared quotas configured.')
    parser.add_argument('--require-submission', action='store_true', help='Also require recorded video length/playback, public submission listing, and eligibility clarification.')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.expect_commit and not re.fullmatch(r'[a-fA-F0-9]{40}', args.expect_commit):
        parser.error('--expect-commit must be a full Git SHA')
    checks = []

    def check(name, operation):
        try:
            detail = operation()
            return {'name': name, 'passed': True, 'detail': detail}
        except Exception as error:
            # No dependency tokens or uploaded CSV contents enter this public report.
            return {'name': name, 'passed': False, 'error': str(error)}

    def route(path):
        status, body = fetch(args.web_url.rstrip('/') + path)
        if status != 200 or b'<div id="root"' not in body:
            raise ValueError('Application shell unavailable')
        return {'httpStatus': status, 'scope': 'HTTP shell only; browser interaction is checked separately'}

    with ThreadPoolExecutor(max_workers=4) as pool:
        checks.extend(pool.map(lambda path: check('route:' + (path or '/'), lambda: route(path)), ROUTES))
    live = {}
    for path in ['/health', '/status', '/ready']:
        def probe(path=path):
            code, body = fetch(args.checker_url.rstrip('/') + path)
            value = json.loads(body)
            if code != 200 or value.get('ok') is not True:
                raise ValueError('Checker endpoint is not healthy')
            live[path] = value
            return {'httpStatus': code, 'response': value}
        checks.append(check('checker:' + path, probe))

    def release():
        _, body = fetch(args.web_url.rstrip('/') + '/release.json')
        metadata = json.loads(body)
        if metadata.get('format') != 'gapwitness/release/v1':
            raise ValueError('Deployment does not expose a GapWitness release manifest')
        if args.expect_commit and (metadata.get('commit') != args.expect_commit or metadata.get('dirty') is True):
            raise ValueError('Deployed source does not match the requested clean commit')
        return metadata
    checks.append(check('deployed-source', release))
    for name in ['file_a.csv', 'file_b.csv', 'file_c_impossible.csv']:
        checks.append(check('fixture:' + name, lambda name=name: inspect_fixture(args.checker_url.rstrip('/'), name)))
    checks.append(check('retained-corpus', lambda: {'windows': len(verify_corpus()), 'allMatched': True}))
    shared = live.get('/status', {}).get('quotas', {}).get('sharedConfigured') is True
    if args.require_shared:
        checks.append({'name': 'production-shared-quota', 'passed': shared, 'detail': 'Shared configuration reported by the actual service. Readiness and fixture admission are checked separately.'})
    links = json.loads((ROOT / 'docs/submission-links.json').read_text())
    gaps = submission_gaps(links)
    if args.require_submission:
        checks.append({'name': 'external-submission-evidence', 'passed': not gaps, 'detail': gaps})
    passed = all(item['passed'] for item in checks)
    report = {'format': 'gapwitness/release-check/v1', 'checkedAt': datetime.now(timezone.utc).isoformat(),
              'webUrl': args.web_url, 'checkerUrl': args.checker_url, 'checks': checks,
              'requestedChecksPassed': passed, 'productionSharedQuotaConfigured': shared, 'externalSubmissionGaps': gaps,
              'limits': ['Point-in-time HTTP and exact evidence checks do not replace browser tests or a fresh Sepolia RPC verification.',
                         'No independent pilot, operator authority, video playback, or Devpost submission is inferred from software tests.']}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'passed': passed, 'checksPassed': sum(item['passed'] for item in checks), 'checksTotal': len(checks), 'sharedQuotaConfigured': shared, 'externalSubmissionGaps': gaps}))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
