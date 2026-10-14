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
```

Use an owned persistent Redis REST store. Never commit credentials. Salt changes reset client identities. Limits are configurable deployment choices, not measured production capacity. Vercel client-IP headers are trusted only when running on Vercel, which overwrites them; other environments use the ASGI peer address and require an appropriate trusted-proxy deployment arrangement.

The retained shared-quota-integration.json records a real HTTPS Redis experiment: two independent limiter objects, twelve simultaneous requests from one synthetic client, a shared limit of three, three admissions and nine denials. Its store was a temporary 72-hour agent database, not production. A workspace-specific transport used a thirty-second test timeout; production retains a three-second HTTPX timeout. This does not measure production latency, load capacity, or uptime.

Production shared quotas have not been activated. The Vercel environment connector denied environment access, so no persistent credentials were installed. The live status page reports the actual mode instead of assuming shared protection is enabled.

/health proves process reachability. /status exposes bounded instance counters and quota configuration without CSV contents, client addresses, or credentials. /ready checks the configured Redis dependency using PING, cached for at most fifteen seconds, and returns 503 on dependency failure. With no configured dependency it explicitly says not configured. PING reachability alone does not prove write permission or successful admission; the atomic admission check remains fail-closed.

The service-monitor GitHub workflow checks health, status, readiness, and frozen corpus integrity twice hourly and retains timestamped artifacts. Scheduled GitHub runs can be delayed. Reports and instance counters are not a global uptime percentage. Monitoring failures do not send unsolicited messages.
