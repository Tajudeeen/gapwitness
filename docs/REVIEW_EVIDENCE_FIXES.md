# Review evidence follow-up, 27 October 2026

The current review workflow now retains schedule source documents, checks bounded arithmetic claims and records all pilot attempts. Historical submission videos and contract records are not rewritten.

## Claims and implementation

| Claim | Implementation | Verification | Boundary |
| --- | --- | --- | --- |
| Keep a source schedule with an inspection | `web/src/lib/schedule.ts`, `SchedulePanel.tsx`, evidence package integration | Context/document/declaration substitution tests; browser export, reopen and changed-issuer rejection | Reviewer-confirmed declaration, not issuer authentication. Not included in historical chain commitment. |
| Unknown measurements do not become observed values | `reporting-decision.ts`, Review panel, printable report, deterministic Python brief | Controlled File A changes available-row acceptance to unresolved at illustrative 3.1 µg/m³; complete File B rejects that threshold. Missing-value and negative-policy tests | Assumes the declared window and non-negative PM2.5 policy. No regulatory threshold, misconduct or environmental outcome is established. |
| Assistance descriptions match the implementation | Header suggestions, missing-run descriptions and template briefs | Tests exclude confidence scores and causal attribution; moving the gap's UTC hours does not change its classification | No trained model or generative inference. Unknown values remain unknown. |
| Failed or unfinished reviewer work stays visible | Pilot phase start/completion/abandonment log with separate export | Tests retain wrong completions, prohibit completed-outcome rewrites and preserve interrupted starts through refresh | Local records do not authenticate participant identities. Pair statistics still require real reviewers. |

## Checks performed

- `npm test` in `web`: 44 tests passed, including controlled evaluation, evidence, wallet and new schedule/decision/attempt cases.
- `npm run build` in `web`: TypeScript and Vite passed. Existing large-bundle warning remains.
- `PYTHONPATH=checker:scripts python -m pytest checker/tests scripts/test_*.py -q`: 101 passed. One dependency deprecation warning remains.
- Seven browser scenarios passed with a local FastAPI checker and Vite server: new schedule/decision/attempt flows plus existing mapping, source preservation, legacy browser saves and narrow-phone import layout. The two new scenarios were rerun after final changes and passed.
- Python review brief on retained File A: seven missing hours, available mean approximately 2.9882, lower bound approximately 2.1167, unbounded upper, unresolved at 3.1.
- `git diff --check`: passed.

Browser tests used Chromium 153 from a temporary serverless Chromium package because the normal Playwright download returned truncated archives. No browser package or production dependency was added to the repository. Test participants and schedule documents were explicitly fictional local fixtures, not pilot observations or authenticated operator evidence.

## Still requires external evidence

An actual operator/source document establishing the station's expected schedule, consenting independent reviewers and their observed results, and a real reporting case with independently assessed consequences. The implementation supports retaining and testing that evidence; this follow-up does not manufacture it.
