# Admission and monitoring

The checker bounds file bytes, assembled request bytes, upload time, and active inspections. INSPECT_MAX_CONCURRENT defaults to four, with a supported range of one to thirty-two. A slot covers quota dependency requests as well as upload assembly and inspection. Exhausted capacity rejects a request with 503 before calling the quota backend, reading, or parsing its body. This is an instance bound, not a global concurrency guarantee.

Optional distributed quotas use a single atomic Redis Lua command. Redis TIME establishes fixed windows. Global admission is checked before allocating a client counter. Client identifiers are HMAC-hashed with a protected salt. Keys share a Redis Cluster hash slot. Counters expire at the window boundary. Configured dependency failure rejects inspection with 503; incomplete configuration prevents startup. Without shared configuration the existing bounded limiter is per process.

Protected checker environment variables:

```text
QUOTA_REDIS_REST_URL=https://your-owned-store.example
QUOTA_REDIS_REST_TOKEN=<protected write-capable REST token>
QUOTA_HASH_SALT=<random secret of at least 32 characters>
INSPECT_GLOBAL_RATE_LIMIT=3000
INSPECT_RATE_LIMIT=30
INSPECT_RATE_WINDOW_SECONDS=60
INSPECT_MAX_CONCURRENT=4
REQUIRE_SHARED_QUOTA=true
```

Use an owned persistent Redis REST store. Never commit credentials. Salt changes reset client identities. Limits are configurable deployment choices, not measured production capacity. Vercel client-IP headers are trusted only when running on Vercel, which overwrites them; other environments use the ASGI peer address and require an appropriate trusted-proxy deployment arrangement.

The retained shared-quota-integration.json records a real HTTPS Redis experiment: two independent limiter objects, twelve simultaneous requests from one synthetic client, a shared limit of three, three admissions and nine denials. Its store was a temporary 72-hour agent database, not production. A workspace-specific transport used a thirty-second test timeout; production retains a three-second HTTPX timeout. This does not measure production latency, load capacity, or uptime.

Production shared quotas have not been activated. The Vercel environment connector denied environment access, so no persistent credentials were installed. The live status page reports the actual mode instead of assuming shared protection is enabled.

`REQUIRE_SHARED_QUOTA=true` prevents a production deployment from silently starting with per-process quotas if a protected value is removed. Configure all three protected values before enabling it. Development defaults to false. `checker/.env.example` records the complete configuration without secrets.

## Activate and verify

1. Create an owned persistent Redis REST store. A temporary expiring agent database is unsuitable.
2. In the existing `gapwitness-checker` production project's environment settings, install `QUOTA_REDIS_REST_URL`, `QUOTA_REDIS_REST_TOKEN`, and a random `QUOTA_HASH_SALT` of at least 32 characters as protected values. Do not put them in Git, a video, or the web project.
3. Add `REQUIRE_SHARED_QUOTA=true` and the bounded limits above, then redeploy the checker. Install production values in production only.
4. Run `python scripts/check_release.py --require-shared --output /tmp/gapwitness-release.json`. This checks live status, readiness and actual fixture admission. A PING response alone is insufficient.
5. To test cross-instance behavior, use the retained `SharedQuota` integration harness against a separate test namespace/store. Do not load-test the public demo or count temporary-store results as production capacity.

On October 18, the authenticated Vercel connection again returned HTTP 403 for the existing `deeencodes` scope. No local Vercel CLI credentials were available. The code and setup instructions are complete, but production activation must remain pending until project environment access is restored or the owner installs the values in the dashboard.

/health proves process reachability. /status exposes bounded instance counters and quota configuration without CSV contents, client addresses, or credentials. /ready checks the configured Redis dependency using PING, cached for at most fifteen seconds, and returns 503 on dependency failure. With no configured dependency it explicitly says not configured. PING reachability alone does not prove write permission or successful admission; the atomic admission check remains fail-closed.

The service-monitor GitHub workflow checks health, status, readiness, and frozen corpus integrity twice hourly and retains timestamped artifacts. Scheduled GitHub runs can be delayed. Reports and instance counters are not a global uptime percentage. Monitoring failures do not send unsolicited messages.
