# Production Readiness Actions (Security + Backend + Scale)

Scope: review of the current Next.js (App Router) codebase using Supabase (SSR + RPCs) and Upstash Redis, including route handlers, middleware, and server actions, with focus on issues to address before a production launch.

## Executive summary (what to do first)

1. **Remove and rotate leaked secrets**: the repository contains a local env file with a **Supabase Service Role key** (full DB bypass). Assume compromise and rotate immediately.
2. **Tighten security headers/CSP**: current CSP allows `unsafe-inline`, `unsafe-eval`, and `frame-src *`, which significantly increases XSS/embedding risk.
3. **Add rate limits + guardrails to device/media endpoints**: especially `/api/player/media-url` and any device-auth endpoints exposed to the public internet.
4. **Fix Redis heartbeat querying**: using `KEYS` for heartbeats will not scale; replace with a `SCAN`-based approach or indexed/set-based tracking.
5. **Resolve lint/build blockers and remove dev artifacts**: `npm run lint` reports many errors; `.next/` and `node_modules/` exist in the working tree and should never be published.

---

## API surface inventory (what exists today)

### HTTP route handlers (App Router)

- `POST /api/player/media-url`  
  File: `app/api/player/media-url/route.ts`  
  Purpose: return signed URL for a device session token + file path.

- `GET /auth/callback`  
  File: `app/auth/callback/route.ts`  
  Purpose: Supabase OAuth callback → exchange code for session → redirect to correct tenant dashboard.

- `POST /auth/signout`  
  File: `app/auth/signout/route.ts`  
  Purpose: sign out with Origin/Referer validation (CSRF guard).

### Server actions (not “routes”, but callable remotely by the client)

Device/player actions (public-facing via `/player` UX):
- `registerDevice`, `refreshDeviceCode`, `getDeviceState`, `unpairDevice`, `updateDeviceOrientation`
- `incrementPlaytime`, `sendHeartbeat`
- `getPlaylistItems`, `getSignedMediaUrl`, `getPlayerAsset`

Customer dashboard actions (authenticated user context):
- Assets: `getUploadUrl`, `insertAsset`, `deleteAsset`, `updateAssetName`, …
- Playlists: `createPlaylist`, `updatePlaylist`, `deletePlaylist`, `getPlaylistItems`
- Screens/devices: `claimDevice`, `updateDeviceAssignment`, `deleteAndUnpairDevice`, `getDeviceHeartbeats`, `updateDeviceLastSeen`, `updateDeviceName`

---

## Findings & actions (with criticality)

Criticality legend:
- **Critical**: likely compromise / tenant isolation break / credential leak / catastrophic data loss
- **High**: real-world exploitability, meaningful data exposure, or major production outage risk
- **Medium**: security hardening or scale issues that will hurt under load
- **Low**: quality, maintainability, or defense-in-depth

### C-01 — Secrets committed to repo (Supabase service role key)

- **Critical**
- Evidence: `.env.local` exists in the repo folder and contains **`SUPABASE_SERVICE_ROLE_KEY`**.
- Why it matters: service role bypasses all RLS policies; anyone with the key can read/write across all tenants.
- Actions:
  1. **Rotate** the leaked Supabase service role key immediately (assume compromise).
  2. Remove `.env.local` from the repo and ensure `.env*` is ignored (it is in `.gitignore`, but the file is still present locally).
  3. If this repository has ever been pushed publicly, **rewrite git history** to remove the secret (or treat the key as permanently compromised even after rotation).
  4. Ensure the service role key is only available to trusted server-only contexts (background jobs), never to browser code and never stored in the repo.

### H-01 — CSP is overly permissive (`unsafe-inline`, `unsafe-eval`, `frame-src *`)

- **High**
- Evidence: `next.config.ts` sets:
  - `script-src 'unsafe-eval' 'unsafe-inline'`
  - `frame-src ... *`
- Why it matters:
  - `unsafe-inline` makes many XSS classes far easier to exploit.
  - `unsafe-eval` broadens gadget surface (and is rarely needed in production).
  - `frame-src *` defeats most of the intent of restricting framing; combined with a “remote URL widget”, you effectively allow arbitrary third-party pages to run in iframes on your player screens.
- Actions:
  1. Remove `unsafe-eval` in production (or scope it only to the minimal routes that require it).
  2. Replace inline scripts with nonced scripts (or move them to external files) so you can remove `unsafe-inline`.
  3. Replace `frame-src *` with an allowlist. If you truly need “any URL widgets”, add a per-tenant allowlist feature and enforce it.

### H-02 — `/api/player/media-url` lacks rate limiting & stricter validation

- **High**
- Evidence: `app/api/player/media-url/route.ts` performs RPC signing based on `deviceId`, `sessionToken`, `filePath` but has no rate limiting.
- Risks:
  - brute force / credential stuffing against `sessionToken`
  - cost-amplification (RPC/signing) DoS
  - path manipulation attempts (depends on DB RPC correctness)
- Actions:
  1. Add **IP-based** and **deviceId-based** rate limiting (Upstash Redis can be reused).
  2. Validate `filePath` format (e.g., must match `^${teamId}/...` or a restricted storage prefix, depending on your storage model).
  3. Consider adding request logging/audit events for repeated failures (401 bursts).

### H-03 — “Remote URL widget” is an intentional but high-risk feature; add guardrails

- **High**
- Evidence:
  - Assets can be created with `mime_type = application/x-widget-remote-url`
  - Player renders it as an `<iframe src={mediaUrl}>` with sandbox: `allow-scripts allow-same-origin allow-forms allow-presentation`
- Risks:
  - third-party scripts executing on production screens
  - tracking, phishing, malicious ad content, or resource exhaustion
- Actions:
  1. Add a **domain allowlist** per tenant (or global allowlist) for remote URL widgets.
  2. Consider removing `allow-same-origin` (safer default) unless a strong business need exists.
  3. Consider disabling `http:` URLs in production (require `https:`).

### M-01 — Heartbeat lookup uses Redis `KEYS` (will not scale)

- **Medium**
- Evidence: `getDeviceHeartbeats()` in `app/customer/[team_slug]/screens/actions.ts` uses `redis.keys('heartbeat:${teamId}:*')`.
- Why it matters: `KEYS` is O(N) and can block Redis under large keyspaces, causing cascading latency/outages.
- Actions:
  1. Replace `KEYS` with `SCAN`-style iteration (or Upstash equivalent) to paginate.
  2. Better: maintain a **set** of active device IDs per team (`SADD team:${teamId}:devices`) and fetch exact keys via `MGET`.
  3. Cap maximum results returned per request and implement pagination.

### M-02 — Asset dashboard signs preview URLs for *every asset* in the list

- **Medium**
- Evidence: `AssetClient.tsx` creates signed URLs for all image/video assets via `Promise.all`, per render/update.
- Why it matters: on large tenants this becomes expensive (many storage signing requests), slow UI, and can hit Supabase limits.
- Actions:
  1. Enforce server-side pagination (limit per page).
  2. Generate signed preview URLs lazily (only for visible rows/cards), or batch-sign via a single RPC.
  3. Cache short-lived preview URLs in-memory per session.

### M-03 — Rate limiting is bypassed if Redis is misconfigured (fail-open)

- **Medium**
- Evidence: `rateLimitAction()` in `lib/redis.ts` returns `true` if Redis credentials are missing.
- Why it matters: a production misconfiguration silently disables protections.
- Actions:
  1. In production, fail closed (especially for auth/signup/device registration) if Redis is missing.
  2. Add a startup health check / CI check to ensure required env vars exist in production deploys.

### M-04 — Excessive console logging may leak operational details

- **Medium**
- Evidence: `claimDevice()` logs pairing code/name/team slug; many other modules log errors/warnings.
- Risks:
  - sensitive identifiers in logs
  - noisy logs → harder incident response
- Actions:
  1. Remove `console.log` from production paths; use a structured logger with severity levels.
  2. Redact pairing codes/secrets/session tokens from logs by default.

### M-05 — Lint currently fails; treat as a production release blocker

- **Medium**
- Evidence: `npm run lint` reports many errors (refs usage during render, `any`, JSX in try/catch, etc.).
- Actions:
  1. Fix or downgrade the failing rules; ensure CI uses lint + typecheck gates.
  2. Address the most impactful issues first:
     - avoid reading `.current` refs in render (copy to state when they change)
     - remove `any` in public/security-sensitive modules (player/auth/actions)

### M-06 — Dependency vulnerabilities found by `npm audit`

- **Medium**
- Evidence: `npm audit --omit=dev` reports moderate vulnerabilities involving `dompurify` (via `monaco-editor`) and `postcss` (via `next` dependency chain).
- Actions:
  1. Upgrade dependencies to versions that resolve advisories where possible.
  2. If a transitive vulnerability has “no fix available”, assess exposure:
     - Is the vulnerable code reachable in production bundles?
     - Do you use the vulnerable feature/mode?  
     If yes, consider alternative libraries or pinning safer versions.

### L-01 — Middleware runs Supabase session refresh for many public pages

- **Low** (may become Medium under heavy traffic)
- Evidence: root `middleware.ts` applies broadly (except `/player` and static assets).
- Why it matters: adds latency and may increase Supabase auth traffic.
- Actions:
  1. Narrow the middleware matcher to protected route prefixes only (e.g. `/customer/:path*`, `/login`, `/signup`) if feasible.
  2. Keep `/player` bypass (good) but also bypass other fully public pages (landing, marketing).

### L-02 — Repository contains build/dev artifacts (`.next/`, `node_modules/`)

- **Low** (but important hygiene)
- Evidence: `.next/` and `node_modules/` directories exist in the repo folder.
- Actions:
  1. Ensure they are not committed/pushed and are excluded from deployment artifacts.
  2. If they are in git history, remove them and consider repo cleanup.

---

## Suggested production hardening checklist (quick)

- Secrets:
  - [ ] Rotate Supabase service role key and any other secrets that may have been present
  - [ ] Use a managed secrets store in production deploys (Vercel env, AWS/GCP secrets, etc.)
  - [ ] Add pre-commit/CI secret scanning (gitleaks/trufflehog)

- Auth & tenancy:
  - [ ] Ensure all “owner-only” mutations call `requireOwner` (most do)
  - [ ] Validate tenant isolation at the database level (RLS + SECURITY DEFINER RPCs)

- Abuse prevention:
  - [ ] Rate limit `/api/player/media-url`
  - [ ] Fail closed on missing Redis config in production

- Observability:
  - [ ] Add request IDs + structured logs; redact secrets
  - [ ] Add Sentry (or equivalent) for client + server error reporting

- Scale:
  - [ ] Replace Redis `KEYS` with `SCAN`/set-based lookups
  - [ ] Paginate assets/playlists/screens lists and avoid per-item signing storms

