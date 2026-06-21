# Android Player — Offline-First Playlist & Caching Architecture

**Status:** Implementation plan **only**. No source code, configuration, database migration, backend function, or application logic has been modified. This is the sole deliverable.
**Date:** 2026-06-21
**Scope:** The NuExis Android Player (`apps/android-player`) — playlist playback, offline caching, cache progress, network/device status UI, offline content delivery, and reliability/recovery.
**Read-only sources of truth:** Android Kotlin sources, the live Supabase project `dpdabdbqhjkmxvwnukev` (schema + RPC definitions), and `supabase/migrations/*`.

> This document is deliberately backend-aware but **backend-agnostic in its proposals**. Where a new RPC or column would help, it is described as a *recommended contract change for a separate backend task* — the Android side must degrade gracefully if it is not present. The Android player must never depend on a backend change that has not shipped.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Existing Issues](#2-existing-issues)
3. [Proposed Architecture](#3-proposed-architecture)
4. [System Components](#4-system-components)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Cache Architecture](#6-cache-architecture)
7. [Synchronization Architecture](#7-synchronization-architecture)
8. [Failure Scenarios](#8-failure-scenarios)
9. [Recovery Mechanisms](#9-recovery-mechanisms)
10. [Implementation Phases](#10-implementation-phases)
11. [Risks and Mitigation](#11-risks-and-mitigation)
12. [Estimated Development Order](#12-estimated-development-order)

---

## 1. Current Architecture Analysis

### 1.1 What exists today

The player is a single-`Activity` app (`MainActivity` extends `AppCompatActivity`) that orchestrates seven collaborators. There is **no foreground service** and **no process persistence**; playback lives entirely inside the Activity lifecycle, kept on screen via `FLAG_KEEP_SCREEN_ON` plus immersive window flags. A `BootReceiver` re-launches `MainActivity` after device reboot.

```
MainActivity
 ├── StorageManager        (SharedPreferences: identity, orientation, scale, mute, session token, cached content type)
 ├── SupabaseClient        (OkHttp REST → /rest/v1/rpc/* ; device secret auth ; rate-limited)
 ├── CacheManager          (filesDir/media ; MD5-hashed filenames ; OkHttp downloads ; .tmp→rename)
 ├── PairingManager        (registration / refresh / unpair)
 ├── ContentSyncManager    (fetches device state, loads a single Asset, offline fallback loop)
 ├── RealtimeClient        (raw Supabase Realtime WebSocket ; devices row + device-pair broadcast channel)
 ├── DiagnosticsManager    (health ping every 5 min ; playback events)
 └── PlayerUIManager       (loading / pairing / expired / connection-error / paired + drawer sidebar)
```

**Content model on the backend (verified against live DB):**

- `devices.content_type ∈ {Asset, Playlist, Schedule}` — currently only `Asset` and `Playlist` are wired on the player; `Schedule` is declared in the check constraint but not consumed.
- `devices.asset_id`, `devices.playlist_id` are the direct assignment; `resolve_device_state()` overlays `screen_groups` → `screen_group_members` inheritance when the device has no explicit content.
- `playlists.version` (integer, optimistic concurrency) and `playlist_items(id, type∈{image,video,widget}, asset_id, duration_seconds, sort_order, widget_type, widget_config)`.
- `assets(id, team_id, file_name, file_path, mime_type, size_bytes, width, height, folder_id, color)`. Files live in the `workspace-media` storage bucket under `<team_id>/<timestamp>-<name>` paths. Widgets are special: their `file_path` holds **JSON config or a URL**, not a storage path (`application/x-widget-*`).

**Manifest contract (verified):** `trg_fn_precompute_manifest_version()` computes a SHA-256 over `content_type:asset_id:playlist_id:orientation:<items-json>` and stores it in `devices.current_manifest_version`. `get_player_manifest()` returns `{manifest_version, device_id, team_id, content_type, orientation, loop_enabled, transition_ms, assignment, playlist:[items]}` — **but this RPC is currently unused by the player** (see §2).

**Realtime contract (verified):**

- The player opens a raw WebSocket to `/realtime/v1/websocket` and joins two channels:
  1. `realtime:public:devices:id=eq.<deviceId>` — postgres_changes on the device row (UPDATE/DELETE).
  2. `realtime:device-pair-<deviceId>` — broadcast channel for `content_update`, `request_screenshot`, `unpair`.
- `realtime:team-status:<teamId>` is a Presence channel the player tracks on to show online.
- The CMS-side notification chain is trigger-driven: editing a playlist/asset fires `notify_devices_for_playlist/asset`, which does `UPDATE devices SET updated_at = now()` on affected devices. That row bump flows through the `supabase_realtime` publication (which publishes `id, team_id, content_type, asset_id, playlist_id, orientation, last_seen_at, total_playtime_seconds, current_manifest_version`) to the player's device-row subscription.

**Sync flow today (single-asset only):** `ContentSyncManager.syncSignageContent()` → `getDeviceState()` → compares a handful of `last*` fields → if `content_type == "Asset"`, calls `loadAssetContent()` which downloads one file via `CacheManager.downloadAsset()` and plays it through `MediaEngine.playVideo/playImage/playWidget`. Realtime `onDeviceUpdated` and `onContentUpdate` both funnel into a fresh `syncSignageContent(forceReload=true)`.

### 1.2 What was deleted and why it matters

`apps/.../playback/PlaylistEngine.kt` was **deleted in the working tree** (present in `HEAD`). It was a working-but-basic playlist sequencer:

- Fetched items via a `getPlaylistItems()` RPC that **no longer exists** in the live DB.
- Sequenced items by `sort_order`, played the active item, preloaded the next, and used `MediaEngine.transitionToNext()` for cross-fades.
- Cached the item list to `StorageManager.setCachedManifest()` and could restart offline via `startOffline(itemsJson)`.
- Had no per-asset integrity checks, no progress reporting, no retry, and downloaded each asset synchronously inside the playback coroutine.

Its removal means **the player currently cannot play playlists at all** — `ContentSyncManager` only handles `content_type == "Asset"`. Any device assigned a `Playlist` falls through to `mediaEngine?.stopAll()` (a blank screen). This is the single most important regression this plan must correct.

### 1.3 Honest assessment

The foundation is **better than the symptoms suggest**. The backend already computes a content-addressable manifest version, already notifies devices via row bumps, already has optimistic concurrency on playlists, and the `MediaEngine` already supports dual-viewport preload/transition. The gaps are concentrated in the player: no manifest consumption, no playlist engine, no real cache validation, no progress/network/device UI, and no reliability layer (no service, no watchdog, no startup validation).

---

## 2. Existing Issues

### 2.1 Playlist playback (critical)

| # | Issue | Evidence |
|---|-------|----------|
| P1 | **Playlists do not play at all.** `ContentSyncManager` only branches on `content_type == "Asset"`; `Playlist` is never handled. | `ContentSyncManager.kt:211-216` |
| P2 | **Manifest RPC is unused.** `get_player_manifest()` returns ordered items + version on the server, but the player never calls it; it re-derives "did content change?" from loose `last*` field comparisons. | `SupabaseClient.kt` has no `getManifest()`; `ContentSyncManager.syncSignageContent` |
| P3 | **Change detection is fragile.** Equality across `name/team_id/orientation/content_type/asset_id/scale_mode/updated_at` can false-negative (e.g. playlist *contents* change without any device-column change except `updated_at`, which the player already watches but discards on equal state) or false-positive (any unrelated `updated_at` bump forces a full reload). | `ContentSyncManager.kt:170-182`, `MainActivity.onDeviceUpdated` |
| P4 | **No transitions/durations honored.** Even when `PlaylistEngine` existed, durations came straight from `duration_seconds`; there was no schedule/dayparting, no transition type selection, and `transition_ms` from the manifest was hardcoded to 350. | deleted `PlaylistEngine.kt`; manifest returns `transition_ms` |
| P5 | **No preload correctness guarantees.** Preload downloaded the next item inside a coroutine that could be cancelled mid-write, leaving `.tmp`/partial files that the next run treats as "missing" and re-downloads. | deleted `PlaylistEngine.preloadItem`, `CacheManager.downloadAsset` |

### 2.2 Caching (critical)

| # | Issue | Evidence |
|---|-------|----------|
| C1 | **No integrity validation.** `isCached()` only checks `exists() && length() > 0`. A truncated or corrupted file is treated as a hit and played, producing a black/garbled frame or an ExoPlayer error. | `CacheManager.kt:43-49` |
| C2 | **No size/version awareness.** The MD5-of-path filename is stable per path, but if the *content* at a path changes (asset re-upload to the same key, or a storage overwrite) the cache never knows. There is no `ETag`/`Content-Length`/hash comparison. | `CacheManager.getSanitizedFilename` |
| C3 | **No retry, no backoff.** A failed `downloadAsset()` throws `IOException` and the caller falls back to whatever was last cached — or nothing. No transient-error distinction, no resumable downloads, no exponential backoff. | `CacheManager.downloadAsset`, `ContentSyncManager.loadAssetContent` catch block |
| C4 | **Synchronous download blocks playback.** Downloads happen on the playback path; a large video blocks the active frame from advancing and the UI from reflecting progress. | `ContentSyncManager.loadAssetContent` |
| C5 | **Stale eviction is coarse.** `evictStaleFiles()` is keyed on the *current* active set; during a partial update the newly-required-but-not-yet-downloaded files are not in the active set and can be deleted out from under an in-flight download. | `CacheManager.evictStaleFiles` |
| C6 | **No storage-pressure awareness.** Nothing checks free disk before downloading; a full disk produces a silent `IOException` and a blank screen. | no call site |
| C7 | **Widget/JSON "files" are mishandled.** Widgets store config in `file_path`; `downloadAsset` would try to HTTP-GET a JSON string. The code special-cases this ad-hoc in two places instead of in the cache layer. | `ContentSyncManager.loadAssetContent:249`, `MediaEngine.playWidget` |

### 2.3 Cache progress, network & device UI (gap)

| # | Issue |
|---|-------|
| U1 | **The sidebar shows only control buttons** (refresh, unpair, mute, orientation, close). There is **no** total/downloaded/remaining/percentage, no current-asset indicator, no cache status. |
| U2 | **No network status display.** `ConnectivityManager.NetworkCallback` is registered only to re-trigger realtime; its `onAvailable`/`onLost` never reach the UI. The sidebar cannot show online/offline/reconnecting. |
| U3 | **No device info panel.** IP address, network type (WiFi/Ethernet), last sync, storage/cache/available — none are surfaced. `DiagnosticsManager` computes `freeDiskBytes`/`networkType` but only ships them to the server, never to the local UI. |

### 2.4 Offline content delivery & reliability (critical)

| # | Issue | Evidence |
|---|-------|----------|
| R1 | **Offline = blind polling.** `startOnlineCheckLoop()` polls `getDeviceState()` every 30 s while offline; there is no server-side pending-update queue and no client-side "catch up on reconnect" beyond re-running the same sync. | `ContentSyncManager.startOnlineCheckLoop` |
| R2 | **No background service.** The app dies with the Activity. A crash, an OOM kill, a system memory trim, or "OK Google" stealing focus can blank the screen with nothing to revive it except a manual relaunch or reboot. | `AndroidManifest.xml` has only Activity + BootReceiver |
| R3 | **No watchdog.** Nothing detects a frozen player thread or a black screen and restarts playback. |
| R4 | **No startup validation.** On launch the player trusts cached prefs without verifying the media files still exist, are complete, and match the cached manifest version. |
| R5 | **Playback switches mid-download today.** Because downloads are inline, a new assignment can cut to a not-yet-cached asset and then fail; there is no "play old until new is fully ready" guarantee. |

---

## 3. Proposed Architecture

### 3.1 Guiding principles

1. **Playback never blocks on the network.** The active manifest is always fully cached before it becomes the "live" manifest. New content downloads in the background; the switch happens atomically once validated.
2. **The manifest is the single source of truth for "what changed".** Stop comparing loose device fields. Compare `current_manifest_version` (and, as a fallback, a client-computed hash of the item list).
3. **Three manifest generations, always.** *Live* (currently playing, fully cached), *Staged* (downloading, not yet switched), *Archive* (previous live, kept as rollback). This makes updates non-disruptive and gives free rollback.
4. **Everything is an asset.** Images, videos, PDFs, widgets, playlist metadata, schedules — all flow through one cache pipeline with one integrity/version model. Web content is cached where possible (offline HTML snapshots) and flagged live-only where not.
5. **Reactive state bus.** A single observable `PlayerState` (StateFlow) feeds the sidebar: cache progress, network, device info. UI updates are local and instant; the server is never queried to refresh the UI.
6. **Defensive by default.** Integrity checks, retry/backoff, disk-pressure guards, watchdog, foreground service, startup validation — all mandatory, not optional.

### 3.2 Target component map

```
                    ┌─────────────────────────────────────────────────────┐
                    │                PlayerService (foreground)            │
                    │  owns lifecycle of all managers below; survives      │
                    │  Activity death; started at boot/pair; sticky notif.  │
                    └─────────────────────────────────────────────────────┘
                                         │
   ┌──────────────┐   ┌─────────────────┴────────────────┐   ┌──────────────┐
   │ RealtimeClient│   │        ManifestCoordinator        │   │ WatchdogTimer│
   │  (unchanged)  │──▶│  fetch → diff → stage → promote   │◀──│  heartbeat   │
   └──────────────┘   └────────────────┬───────────────────┘   └──────────────┘
                                         │
        ┌────────────────┬───────────────┼───────────────┬─────────────────┐
        ▼                ▼               ▼               ▼                 ▼
 ┌─────────────┐  ┌─────────────┐  ┌────────────┐  ┌────────────┐   ┌──────────────┐
 │DownloadQueue│  │ CacheStore  │  │PlaylistEng │  │ MediaEngine│   │ PlayerState  │
 │ (prioritized│  │ (3-gen dirs,│  │ (sequencer,│  │ (unchanged │   │ (StateFlow:  │
 │  retry/back)│  │  index DB)  │  │  scheduler)│  │  dual VP)  │   │  cache/net/  │
 └─────────────┘  └─────────────┘  └────────────┘  └────────────┘   │  device)     │
                        ▲                                               └──────┬───────┘
                        │                                                      │
                ┌───────┴────────┐                                    ┌────────▼───────┐
                │ IntegrityChecker│                                   │  SidebarView   │
                │ (SHA-256/size)  │                                   │ (observes bus) │
                └─────────────────┘                                   └────────────────┘
```

### 3.3 The three-manifest-generation model (core idea)

```
filesDir/
  manifests/
    live.json          ← currently playing; guaranteed fully cached
    staged.json        ← downloading; promoted to live only when 100% valid
    archive.json       ← previous live; rollback target (kept ≤ N versions)
  media/
    live/<assetkey>    ← files referenced by live.json
    staged/<assetkey>  ← files referenced by staged.json
```

A *promotion* = `staged → live` is an atomic rename-and-swap guarded by the integrity checker. Until staged is 100% valid, **live keeps playing**. This satisfies the hard requirement: *existing content continues playing* while new content downloads, and *playback switches only after downloads complete successfully*.

---

## 4. System Components

### 4.1 `PlayerService` (foreground service) — *new*

- **Responsibility:** owns the entire playback pipeline; keeps it alive when the Activity is backgrounded or killed; shows a low-priority sticky notification ("NuExis Player running").
- **Lifecycle:** started on successful pair (`START_FOREGROUND`), stopped/restarted on unpair. `BootReceiver` starts it directly (instead of launching the Activity) so signage resumes headless after a reboot; the Activity attaches to the running service as a UI client.
- **Binding:** `MainActivity` binds to it via `LocalService` connection. UI events (drawer open/close, orientation change) become IPC calls; playback state flows back through the `PlayerState` bus observed by the Activity.
- **Crash protection:** the service is `START_STICKY`; `onStartCommand` re-initializes the pipeline from `live.json` if state was lost.

### 4.2 `ManifestCoordinator` — *new*

- **Responsibility:** the brain. Fetches the manifest, diffs it against live, drives the download queue, validates, and promotes.
- **API (sketch):**
  - `sync(trigger: SyncTrigger)` — fetch `get_player_manifest()`, compare `manifest_version` to `live.manifest_version`.
  - On diff: write `staged.json`, enqueue all new/changed assets into `DownloadQueue`, mark `staged.status = DOWNLOADING`.
  - On queue drained + all-valid: `promote()` (staged→live, live→archive), hand new live manifest to `PlaylistEngine`.
  - On any asset permanently failed (exhausted retries): mark `staged.status = FAILED`, surface error in `PlayerState`, **keep live playing**.
- **Change detection strategy (in priority order):**
  1. Server `current_manifest_version` (SHA-256 of content) — primary.
  2. Client-computed SHA-256 of the `playlist[]` item list — fallback when server omits version.
  3. `devices.updated_at` monotonic bump — last-resort "something changed, re-fetch" signal only (never used to decide *what* changed).
- **Offline behavior:** if the fetch fails, it does **not** touch live; it simply records "last sync attempt failed" and lets the network monitor schedule the next attempt.

### 4.3 `DownloadQueue` — *new*

- **Responsibility:** ordered, persistent, resumable download pipeline.
- **Features:**
  - Priority: currently-playing-region assets first (so a partial live set heals fastest), then the rest by `sort_order`.
  - Per-item state machine: `PENDING → DOWNLOADING → VALIDATING → READY | FAILED | RETRYING`.
  - Resumable: stores `bytesWritten` per item; resumes via HTTP `Range` when the signed URL + storage support it.
  - Retry with exponential backoff: `1s, 2s, 4s, 8s, 16s, 60s` cap, max 6 attempts; classifies errors (transient network → retry, 404/403 → fail fast, disk-full → pause queue and alert).
  - Concurrency: 2–3 parallel downloads (tunable; lower on low-memory devices).
  - Emits progress events into `PlayerState` (per-asset + aggregate).
- **Persistence:** queue state written to a small SQLite/Room table so it survives restarts; `.part` files are reused, not discarded.

### 4.4 `CacheStore` — *replaces/augments `CacheManager`*

- **Responsibility:** owns the on-disk cache: three-generation layout, an index DB, validation, eviction, cleanup.
- **Index DB (Room):** `cache_entries(key TEXT PK, manifest_version TEXT, asset_id TEXT, mime_type TEXT, size_bytes INT, sha256 TEXT, status TEXT, bytes_downloaded INT, created_at, last_used_at)`.
- **Key derivation:** `sha256(file_path)` — stable across renames, collision-resistant. (Replaces the current MD5-of-path scheme, which was fine but offered no content binding.)
- **`getCachedFile(key, expectedSha256, expectedSize)`:** returns the file **only if** on-disk size matches `expectedSize` **and** SHA-256 matches `expectedSha256`. This is the integrity gate the player currently lacks.
- **Eviction (LRU + generation-aware):** never evicts `live/` files. Evicts `archive/` first, then `staged/` only if not in-flight, then never touches live. Honors a configurable max cache size and a "keep free disk ≥ X" floor.
- **Cleanup rules:** removes `.tmp`/`.part` older than T+1h on startup; removes orphan index rows whose file is gone; removes orphan files with no index row and no manifest reference.

### 4.5 `IntegrityChecker` — *new*

- **Responsibility:** the single place that decides "is this file good?".
- **Checks, in order:**
  1. Exists and `length() == expectedSize`.
  2. SHA-256 == expected hash (the manifest/asset must carry `size_bytes`; the player computes SHA-256 on first successful download and persists it, then re-validates on every promote and on startup).
- **Streaming hash:** computed during download (single pass) to avoid a second read for large videos.
- **Corruption handling:** on mismatch, delete the file, mark the queue item `RETRYING`, and if it fails again after re-download, `FAILED` + report `cache_status=CORRUPT` via `DiagnosticsManager`.

### 4.6 `PlaylistEngine` — *rebuilt*

- **Responsibility:** consume a *fully-cached* live manifest and produce a smooth playback sequence.
- **Capabilities beyond the deleted version:**
  - Honors `duration_seconds`, `transition_ms`, `loop_enabled` from the manifest.
  - Daypart/schedule support (when `Schedule` content type arrives): filters items by active time windows computed against device-local clock with a UTC reference; falls back to "play all" if clock is unknown.
  - Seamless swap on promote: if the new live manifest shares the currently-playing item id, it continues without a visible jump; only the upcoming schedule changes.
  - Error isolation: a single item that fails to render (e.g. corrupt despite validation — rare) is skipped and logged, not fatal.
- **Preload:** preloads the **next** item into `MediaEngine`'s second viewport using files already guaranteed-cached by `CacheStore`.

### 4.7 `MediaEngine` — *largely unchanged*

- Keep the dual-viewport (`viewportA`/`viewportB`) preload + `transitionToNext()` design; it is already correct.
- **Additions:**
  - PDF rendering via a local renderer (e.g. rendered to bitmaps or a WebView with a bundled PDF viewer) since `application/pdf` assets exist in the contract.
  - A `renderError(throwable)` slot so the engine can show a branded "content temporarily unavailable" frame instead of black, while the queue retries.

### 4.8 `PlayerState` — *new* (reactive bus)

A single Kotlin `data class` exposed as `MutableStateFlow<PlayerState>`, observed by the Activity's sidebar. Fields:

```kotlin
data class PlayerState(
  // Cache progress
  val cacheTotalAssets: Int,
  val cacheDownloadedAssets: Int,
  val cacheRemainingAssets: Int,
  val cachePercent: Int,            // 0..100
  val cacheCurrentAssetName: String?,
  val cacheStatus: CacheStatus,     // IDLE | DOWNLOADING | READY | VALIDATING | FAILED | DISK_FULL
  val manifestVersion: String?,
  // Network
  val networkOnline: Boolean,
  val networkRealtimeConnected: Boolean,
  val networkLastServerContact: Instant?,
  val networkReconnecting: Boolean,
  // Device
  val deviceLocalIp: String?,
  val deviceNetworkType: String?,   // WiFi | Ethernet | Cellular | Offline
  val deviceLastSyncAt: Instant?,
  val deviceStorageUsedBytes: Long,
  val deviceCacheUsedBytes: Long,
  val deviceStorageAvailableBytes: Long
)
```

Every producer updates only its slice; the UI never polls and never queries the server.

### 4.9 `NetworkMonitor` — *new*

- Wraps `ConnectivityManager.NetworkCallback` (`onAvailable/onLost/onCapabilitiesChanged`) + the realtime client's connected/disconnected callbacks.
- Emits into `PlayerState.network*` **locally and instantly** (no server round-trip).
- Distinguishes *internet availability* (`NET_CAPABILITY_VALIDATED`) from *connection existence*.
- Records `networkLastServerContact` on every successful RPC/WebSocket frame.

### 4.10 `DeviceInfoProvider` — *new*

- Local IP (via `NetworkInterface` enumeration, first non-loopback IPv4).
- Network transport (`TRANSPORT_WIFI` / `TRANSPORT_ETHERNET` / `TRANSPORT_CELLULAR`).
- Storage: `StatFs` on the cache dir (used + available) and sum of `media/live` size (cache used).
- Refresh cadence: on network change, on download completion, and on a 60 s timer — all local.

### 4.11 `WatchdogTimer` — *new*

- A heartbeat: the playback loop posts a "tick" every N seconds; if no tick within `2×N`, the watchdog restarts the `PlaylistEngine` (and, if still stuck, the whole `PlayerService`).
- Detects frozen ExoPlayer, dead coroutines, and ANR-adjacent stalls.

---

## 5. Data Flow Diagrams

### 5.1 Realtime content update → cache → promote → play

```
CMS edits playlist
   │
   ▼
trigger: notify_devices_for_playlist()  →  UPDATE devices SET updated_at=now()
   │                                          (also recomputes current_manifest_version via trg_precompute)
   ▼
supabase_realtime publication  ──────►  Android RealtimeClient (devices row channel)
   │                                          │
   │                                          ▼ onDeviceUpdated(record)
   │                                   ManifestCoordinator.sync(REALTIME)
   │                                          │
   │                                          ▼ get_player_manifest()  (REST)
   │                                   compare manifest_version vs live.manifest_version
   │                                          │ changed?
   │                                          ▼
   │                                   write staged.json + enqueue Δ assets in DownloadQueue
   │                                          │
   │                                          ▼ (background, parallel)
   │                                   DownloadQueue: signed URL → stream → .part → validate → READY
   │                                          │
   │                              PlayerState.cachePercent ──► Sidebar (live %)
   │                                          │
   │                                          ▼ all READY + valid
   │                                   promote(): staged→live, live→archive
   │                                          │
   │                                          ▼
   │                                   PlaylistEngine.loadManifest(live)  ← seamless swap
   │
   └── (meanwhile) live keeps playing uninterrupted the entire time ◄────────┘
```

### 5.2 Offline → reconnect → catch-up

```
Device loses internet
   │
   ▼
NetworkMonitor.onLost  ──►  PlayerState.networkOnline=false, sidebar shows OFFLINE
   │                          (live manifest keeps playing from local cache — no interruption)
   ▼
CMS pushes new content while device offline
   │   (server-side: device row gets updated_at bump + new manifest_version;
   │    nothing is "queued" specifically for this device today — see §7.4 recommendation)
   ▼
... device reconnects ...
   │
   ▼
NetworkMonitor.onAvailable  ──►  RealtimeClient reconnects  ──►  onConnected()
   │
   ▼
ManifestCoordinator.sync(RECONNECT)  ──► fetches manifest, sees new version,
   │                                      stages + downloads + promotes as in 5.1
   ▼
Playback switches to new content only after staged is 100% valid
```

### 5.3 Boot / crash recovery

```
BOOT_COMPLETED  ──►  PlayerService.onStartCommand
   │
   ▼
StartupValidation:
   1. identity present? (secret + deviceId) ── no ──► launch pairing UI
   2. live.json present & parseable? ── no ──► promote archive → live; if none, fetch manifest
   3. for each asset in live: CacheStore.getCachedFile(validated)? ── no ──► re-enqueue in DownloadQueue
   4. PlaylistEngine.loadManifest(live)
   │
   ▼
Playback resumes within seconds of boot, before any network round-trip
```

---

## 6. Cache Architecture

### 6.1 Storage structure

```
context.filesDir/nuexis_player/
├── manifests/
│   ├── live.json                 # {manifest_version, content_type, orientation, items:[…], fetched_at}
│   ├── staged.json               # same shape + {status, download_started_at}
│   └── archive/                  # rolling: archive-<version>.json (keep last 3)
├── media/
│   ├── live/<sha256-key>         # files for live.json
│   └── staged/<sha256-key>       # files for staged.json (.part while downloading)
├── index.db                      # Room: cache_entries, download_queue, playback_state
└── prefs-backup/                 # mirrored identity (uses existing IdentityBackupManager pattern)
```

*Rationale for the `live/` vs `staged/` split under `media/`:* it makes the promotion a directory-level atomic operation (rename `staged/*` → `live/*`) and guarantees an in-progress staged download can never be evicted by an LRU pass that only looks at `live/` references.

### 6.2 What gets cached (every asset type)

| Asset type | MIME pattern | Cached? | Notes |
|---|---|---|---|
| Images | `image/*` | ✅ file | Validated by size + SHA-256. |
| Videos | `video/*` | ✅ file | Streaming-hash during download; ExoPlayer reads from local file. |
| PDFs | `application/pdf` | ✅ file | New: rendered locally (see §4.7). |
| Local widgets | `application/x-widget-*` (config JSON) | ✅ metadata | `file_path` is JSON config, not a URL — stored inside the manifest, no file download. Widget *bundle* HTML is bundled in APK assets (`widget_bootstrap.html`) today; if widgets gain remote bundles, those are cached too. |
| Remote-URL widgets | `application/x-widget-website` / `-remote-url` | ⚠️ best-effort | Cache the page's static HTML/JS **where the site allows** (offline snapshot via WebView `saveArchive`). When the site forbids caching or needs live data (e.g. a live dashboards), mark `live_only=true` and show a "requires connection" state when offline — never a blank screen. |
| Playlist metadata | — | ✅ `live.json` | The whole manifest is a cacheable artifact. |
| Schedule data | — | ✅ `live.json` | Daypart windows are part of the manifest; evaluated locally. |

### 6.3 Cache validation

- **On download complete (write):** compute SHA-256 in-stream; store in `index.db`. Compare to `expectedSize` from the manifest asset object (`size_bytes`).
- **On promote (staged→live):** re-run `IntegrityChecker` over every staged asset. Any failure blocks promotion; live keeps playing.
- **On startup:** full validation of `live/` assets; re-enqueue any that fail.
- **Periodic (low priority, e.g. daily):** re-validate `live/` to catch bit-rot / SD-card corruption on long-running players.

### 6.4 Asset versioning

- The cache key is `sha256(file_path)`, but the **validity** binding is `(size_bytes, sha256-of-content)`.
- When a CMS re-upload replaces content at the same storage path (same `file_path`, new bytes), the manifest's item list changes (different `size_bytes` → different `manifest_version`), so the old file in `live/` is no longer referenced by `staged.json`; the new one downloads into `staged/`; promotion swaps them. Old file is later evicted by LRU.
- **Recommended backend contract addition (separate task):** include a per-asset `etag`/`sha256` column on `assets` so the player can validate without computing on first download. The player must work *without* this (compute-and-store) but benefits when present.

### 6.5 Content integrity checks

Summary table (full matrix in §8):

| Check | When | On pass | On fail |
|---|---|---|---|
| Size match | download done, promote, startup | accept | delete + retry |
| SHA-256 match | download done, promote, startup | accept | delete + retry; if repeat → CORRUPT + skip item |
| Manifest version match | before promote | swap | block promote, keep live |
| Free disk ≥ floor | before enqueue | proceed | pause queue, alert UI |

### 6.6 Cache cleanup rules

1. **Startup sweep:** delete `.tmp`/`.part` older than 1 h; rebuild index from filesystem truth.
2. **Post-promote sweep:** delete `archive/` files beyond the last 3 versions.
3. **LRU pressure:** if `cacheUsed > maxCache` *or* `freeDisk < floor`, evict in order: `archive/` → orphan `staged/` (never in-flight) → never `live/`.
4. **Orphan removal:** files in `media/` with no index row and no manifest reference are deleted.
5. **Unpair:** wipe `manifests/`, `media/`, `index.db`; keep identity backups only (matches current `clearAll` intent).

### 6.7 Download retry mechanism

- Backoff: exponential `min(base × 2^n, 60s)`, base=1s, n=attempt, **max 6 attempts**.
- Jitter: ±20% to avoid thundering herd across a fleet.
- Classification:
  - **Transient** (timeout, 5xx, `IOException`): retry.
  - **Auth** (401/403): refresh session via `exchangeDeviceSecretForSession()` once, then retry; if still failing, fail-fast (device likely unpaired).
  - **Not found** (404): fail-fast + report; the asset was deleted server-side.
  - **Disk full** (`ENOSPC`): pause whole queue, set `cacheStatus=DISK_FULL`, surface in UI, resume when disk frees.
- Resumability: HTTP `Range: bytes=<written>-` against the signed URL; if the response is `200` (range unsupported), restart that file cleanly.

---

## 7. Synchronization Architecture

### 7.1 Playlist synchronization to the player

- **Primary path:** `get_player_manifest()` RPC — returns ordered items, asset metadata (including `size_bytes`), widget config, `manifest_version`, orientation, transition config. This already exists and is already correct; the player simply must **start calling it** instead of re-deriving state.
- **Fallback path (if `get_player_manifest` is unavailable in a given deployment):** `get_player_device_state()` + per-playlist item fetch. Deprecated, but kept for resilience.

### 7.2 Realtime delivery of playlist updates

Three independent signals, all idempotent, all funneling into `ManifestCoordinator.sync()`:

1. **Postgres row change** on `devices` (the `updated_at`/`current_manifest_version` bump) → `RealtimeClient.onDeviceUpdated`. *Debounced 500 ms* to coalesce rapid edits.
2. **Broadcast `content_update`** on the device-pair channel → `onContentUpdate`. Same debounce bucket.
3. **Presence/heartbeat restore** → `onConnected` after a reconnect. Always triggers a sync (catch-up).

Debounce is essential: a bulk playlist edit can fire many row bumps in quick succession; without coalescing the player would stage/promote repeatedly.

### 7.3 Media ordering, duration, transitions, scheduling

- **Ordering:** strictly by `sort_order` (already enforced server-side in `get_player_manifest` via `ORDER BY pi.sort_order`).
- **Duration:** `duration_seconds` per item; for videos, optional "use native video length" flag (recommended manifest field). Hard floor of e.g. 1 s to avoid strobing.
- **Transitions:** `transition_ms` from manifest (currently 350 ms). Recommended extension: per-item `transition_type ∈ {cut, fade, slide}` — the dual-viewport `MediaEngine` already supports fade; slide/wipe are additive. Until then, honor the global `transition_ms`.
- **Scheduling:** when `content_type == 'Schedule'` ships, each item carries `{active_days[], start_time, end_time, timezone}`; the engine filters the active set against device-local time (timezone pinned to the device setting, with a UTC anchor). Out-of-window items are skipped, not blanked — if *nothing* is active, fall back to the most recent default playlist or a branded placeholder.

### 7.4 Local management of widgets, assets, playlist items

- **Widgets:** config JSON lives in the manifest; no file download. The widget *runtime* (HTML/JS) is bundled in the APK (`assets/widget_bootstrap.html`). If a widget later needs a remote bundle, it becomes a normal cached asset referenced by the widget config.
- **Assets:** all go through `CacheStore`; the playlist engine only ever references validated local files.
- **Playlist items:** the manifest *is* the item list; locally immutable once promoted to `live.json`.

### 7.5 When does the player refresh playback?

A refresh (re-sequence, not re-download) happens when:
- `live.json` changes (a promote occurred), **or**
- a schedule window boundary is crossed (evaluated every 30 s locally), **or**
- orientation/scale changes (applied to the engine without re-downloading).

A *download* (network) happens when:
- `ManifestCoordinator` detects a `manifest_version` diff, **or**
- startup validation finds a missing/corrupt live asset, **or**
- a reconnect follows a period offline with a newer server version.

The two are decoupled: downloads never interrupt playback, and playback refresh never triggers downloads on its own.

### 7.6 Offline content pushing — pending-update queue & recovery

**Today's reality (verified):** the server does **not** maintain a per-device pending-update queue. It relies on (a) the realtime row bump reaching an online device, or (b) the device polling on reconnect. There is no durable "this device missed update X" store.

**Recommendation for the player (within scope):** the player must be fully self-healing on reconnect **without** requiring a server-side queue:

- On every reconnect, `ManifestCoordinator.sync(RECONNECT)` fetches the current manifest and compares `manifest_version`. If newer → stage → download → promote. This naturally catches anything missed while offline.
- The player persists `live.manifest_version` locally, so even across its own restart while offline, it remembers where it was and catches up on reconnect.

**Recommended backend contract addition (separate backend task, out of scope to implement):** a `device_pending_updates` table or a monotonic `content_epoch` per device so the player can request "everything since epoch E". The player's sync logic is written to consume this if present and fall back to full-manifest compare if not.

**Conflict handling:**
- *Optimistic concurrency on edits* is already server-side (`playlists.version`); the player never writes playlists, so it never conflicts there.
- *Stale staged manifest:* if, while downloading staged v2, a v3 arrives, `ManifestCoordinator` cancels/abandons v2's stage dir (items already downloaded move to a reuse pool keyed by content hash — v3 often shares assets with v2) and stages v3. This is the only "conflict" the player manages, and content-addressing makes it cheap.

**Version comparison:** always `manifest_version` (string compare is fine — it's a hash; equality is what matters). Never compare `updated_at` for *equality of content* (it's a timestamp, not a content id).

**Failed-update recovery:**
- A staged manifest that exhausts all retries on ≥1 asset stays `staged.status = PARTIAL`. Live keeps playing. The failed assets are retried on a slow schedule (every 5 min) and on next reconnect.
- If the *entire* fetch fails (offline at sync time), no state changes; next attempt scheduled by `NetworkMonitor`.

---

## 8. Failure Scenarios

| Scenario | Detection | Player behavior | Recovery |
|---|---|---|---|
| **Download fails (transient)** | `IOException` / 5xx in `DownloadQueue` | Item → `RETRYING`, backoff; live unaffected | Retry up to 6×, then `FAILED` |
| **Download fails (404)** | HTTP 404 | Item → `FAILED` fast; report `cache_status=MISSING` | Skipped in staged; if it's the only item, live continues; surfaced in UI |
| **Download fails (403/auth)** | HTTP 401/403 | Refresh session once, retry; else fail-fast | Likely unpaired → `onDeviceUnpaired` |
| **Partial download** | Size mismatch on completion / `.part` exists | Discard `.part`, re-enqueue | Resumes from scratch (or Range if supported) |
| **Corrupted file (post-write)** | SHA-256 mismatch in `IntegrityChecker` | Delete file, `RETRYING`; on repeat → `CORRUPT`, skip item in staged | Promote blocked until clean; item skipped, not fatal |
| **Corrupted file already in live (bit-rot)** | Periodic revalidation / startup validation | Re-enqueue into `DownloadQueue` as a heal; live item plays until heal completes, then swaps | Live stays up; worst case skips the bad item |
| **Storage full** | `ENOSPC` / `StatFs` floor breached | Pause queue, `cacheStatus=DISK_FULL`, keep playing live, alert UI + report `last_error` | LRU eviction of archive; auto-resume when free ≥ floor |
| **Device restarts** | `BootReceiver` → `PlayerService` | Startup validation rebuilds from `live.json` + index.db; resumes playback before network | As §5.3 |
| **App crash / ANR** | Process gone; `PlayerService` `START_STICKY` restarts | Same as reboot path (service re-init from local state) | Watchdog covers sub-process freezes |
| **Player thread frozen** | `WatchdogTimer` no-tick | Restart `PlaylistEngine`; if still stuck, restart `PlayerService` | Bounded recovery attempts (3) before full service restart |
| **Network drops mid-download** | `NetworkMonitor.onLost` | Pause queue (don't fail items); resume on `onAvailable` | Resumes `.part` files; no re-fetch of completed items |
| **Network drops mid-playback** | Same | Live keeps playing from cache; sidebar → OFFLINE; `startOnlineCheckLoop` deprecated in favor of `NetworkMonitor`-driven reconnect | On reconnect → sync catch-up |
| **Realtime socket dies** | `onClosed/onFailure` | `networkRealtimeConnected=false`; existing 5 s reconnect continues; row-bump signals resume on reconnect | Sync also driven by periodic 5-min health fetch as backstop |
| **Manifest fetch fails (online)** | RPC error | Don't touch live; record `lastSyncAt` attempt; retry on backoff | Next realtime signal or health tick |
| **Clock skew (for schedules)** | Detected vs server time header | Fall back to "play all" for schedule; log | Optional: trust server `Date` header to correct |
| **Widget render error** | `WebView.onReceivedError` | Show branded error frame for that item; advance after item duration | Item logged; not fatal to playlist |
| **Unpair while offline** | (server can't reach device) | On next reconnect, `get_player_device_state` returns null → `onDeviceUnpaired` | Clean wipe per §6.6 |
| **APK upgrade** | `PackageInstaller` | `filesDir` preserved; index.db migration on first run of new version | Startup validation covers any format drift |

---

## 9. Recovery Mechanisms

### 9.1 Startup validation checklist (runs on every service start)

1. **Identity:** `secret` + `deviceId` present and restorable (existing `IdentityBackupManager` path). Missing → pairing UI.
2. **Session:** exchange secret for session token if expired/missing.
3. **Manifest:** `live.json` exists and parses. Missing/corrupt → try `archive/` newest → else fetch from server.
4. **Media integrity:** for every asset referenced by `live.json`, `CacheStore.getCachedFile(validated)` succeeds. Failures → enqueue heal in `DownloadQueue` (high priority) **but still allow playback** of the valid subset; the bad item is skipped until healed.
5. **Index consistency:** reconcile `index.db` against the filesystem (remove orphans, re-index orphans).
6. **Cleanup:** startup sweep (§6.6).
7. **Engine:** `PlaylistEngine.loadManifest(live)` → playback resumes.
8. **Network:** `NetworkMonitor` + `RealtimeClient` connect; first `sync(STARTUP)` to catch anything newer.

### 9.2 Crash recovery

- `PlayerService` is `START_STICKY`; Android restarts it after a crash. `onStartCommand` runs the full startup validation above — playback resumes from `live.json` without needing the network.
- `WatchdogTimer` (in-process) catches the case where the service is alive but the playback coroutine is stuck: it cancels and restarts the `PlaylistEngine`; after 3 consecutive watchdog trips it posts a self-restart of the service.

### 9.3 Background service behavior

- Foreground service with a persistent low-priority notification (required by Android for foreground services since Oreo, and acceptable for kiosk/signage apps).
- Acquires a partial `WakeLock` only while actively downloading or during video playback edge cases; released when idle to avoid battery drain on non-powered devices (most signage is powered, but the lock is cheap insurance).
- Survives screen off, `onStop`, and most memory-pressure events (foreground services are last to be killed).
- `BootReceiver` starts the service directly (headless signage), then optionally launches the Activity for devices that show a UI.

### 9.4 Watchdog systems

- **Playback watchdog:** tick every 15 s from the `PlaylistEngine` loop; `2×15 s` timeout → restart engine.
- **Realtime watchdog:** if no WS frame for 90 s (heartbeat is 30 s), force reconnect.
- **Health-report watchdog:** the existing `DiagnosticsManager` 5-min loop doubles as a liveness signal to the server; extended to include `current_manifest_version`, `cache_status`, and `last_error` (already supported by `report_device_health` columns).

---

## 10. Implementation Phases

Each phase is independently shippable and leaves the player no worse than before.

### Phase 0 — Stabilize & Instrument *(prerequisite, ~3 days)*
- Restore minimal playlist playback by adopting the manifest contract (fixes P1/P2 immediately): call `get_player_manifest()`, build a simple sequencer that plays items from already-cached files (no new cache layer yet), wired into the existing `ContentSyncManager`.
- Add `PlayerState` skeleton + `NetworkMonitor`; wire the existing realtime connect/disconnect into it.
- Add structured logging throughout the sync path so the rest of the work is observable.
- **Exit criteria:** a device assigned a playlist actually plays it; no regressions on single-Asset devices.

### Phase 1 — Three-Generation Cache Store *(~6 days)*
- Implement `CacheStore` (live/staged/archive dirs + `index.db` via Room), `IntegrityChecker`, and `DownloadQueue` with retry/backoff.
- Migrate the existing `CacheManager` calls behind `CacheStore`.
- Add startup validation (§9.1).
- **Exit criteria:** every downloaded asset is size+SHA validated; corrupt/partial files are never played; downloads survive a mid-download kill and resume.

### Phase 2 — ManifestCoordinator + Non-Disruptive Updates *(~5 days)*
- Implement `ManifestCoordinator` with diff → stage → promote.
- Replace loose-field change detection with `manifest_version` comparison + debounce.
- Enforce "live plays until staged is 100% valid."
- **Exit criteria:** pushing a new playlist while a device is playing never interrupts playback; the switch happens once, cleanly.

### Phase 3 — PlaylistEngine v2 *(~5 days)*
- Full sequencer: durations, transitions (fade via existing dual viewport), loop, schedule-window filtering (forward-compatible with `Schedule` content type).
- Seamless swap on promote; preload next item from validated cache.
- Per-item error isolation.
- **Exit criteria:** correct ordering, timing, and transitions; a single bad item doesn't kill the playlist.

### Phase 4 — Sidebar UI: Cache Progress + Network + Device *(~4 days)*
- Build the reactive sidebar sections observing `PlayerState`:
  - **Cache:** total / downloaded / remaining / % / current asset / status badge (IDLE/DOWNLOADING/READY/FAILED/DISK_FULL).
  - **Network:** online/offline dot, realtime-connection state, last server contact, reconnecting spinner.
  - **Device:** local IP, transport type, last sync, storage/cache/available bars.
- All updates local and instant (no server queries from the UI).
- **Exit criteria:** every state in §4.8 is visibly reflected within 1 s of the underlying event.

### Phase 5 — Reliability Layer *(~4 days)*
- `PlayerService` (foreground) + migrate `MainActivity` to a bound client.
- `BootReceiver` → start service headless.
- `WatchdogTimer` (playback + realtime).
- Full startup validation + crash recovery drill.
- **Exit criteria:** device survives Activity kill, app crash, and reboot, resuming playback autonomously.

### Phase 6 — Offline Catch-Up & Polish *(~3 days)*
- Reconnect-driven catch-up (§5.2); deprecate the 30 s `startOnlineCheckLoop` polling in favor of event-driven sync.
- Remote-URL widget offline snapshot (best-effort) + graceful "requires connection" state.
- PDF rendering in `MediaEngine`.
- Fleet telemetry: surface `cache_percent`, `cache_status`, `network_type`, `last_sync` to `report_device_health` (columns already exist).
- **Exit criteria:** a device offline for 24 h, then reconnected, fully syncs the latest content with zero manual interaction and zero playback interruption.

**Total estimated effort:** ~30 working days for one engineer, parallelizable to ~18 days with two (Phase 1 & Phase 3 can overlap once the manifest contract in Phase 0 is locked).

---

## 11. Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **`get_player_manifest()` behaves differently across deployments** | Med | High | Player probes capability on first sync; falls back to `get_player_device_state` + item fetch. All manifest handling is defensive/optional. |
| **Signed-URL expiry mid-download** (large video > 1 h) | Med | Med | Default `expires_in` is 3600 s; player requests long-lived URLs for large assets and re-signs on retry. Resumable via `Range`. |
| **Foreground-service restrictions on new Android versions** (Android 14+) | High | High | Use the correct foreground-service type (`mediaPlayback` / `dataSync`); declare in manifest; test on API 34+. Fallback: kiosk-mode devices via `DEVICE_OWNER` exempt from restrictions. |
| **Storage eviction by Android** (`filesDir` is app-private, safe; but `MANAGE_EXTERNAL_STORAGE` currently requested) | Low | Med | Keep all cache under `filesDir` (already true). Drop the broad `MANAGE_EXTERNAL_STORAGE` ask except where identity-backup needs it; reduce permission surface. |
| **WebView memory pressure** (many widget items) | Med | Med | Pool/reuse a single WebView per viewport; destroy aggressively on release (existing pattern in `MediaEngine.Viewport.release`). Cap concurrent WebViews. |
| **Realtime coalescing bug** (over-debounce misses updates) | Low | Med | Always reconcile with a periodic (5-min) manifest fetch as a backstop; debounce tuned to 500 ms with a max-wait cap. |
| **Content-addressing collision** (SHA-256) | Negligible | High | Not a practical concern; mitigated by also binding `(size, hash)`. |
| **Migration from old MD5 cache** (existing devices) | Med | Low | On first run of new version, treat old `media/` as cold cache: validate-and-adopt into `live/` if it matches, else evict. No data loss for users. |
| **Schedule clock skew** | Med | Low | Fall back to "play all"; optional server-time sync. |
| **Watchdog false-positives** restarting a healthy player | Low | Med | Conservative timeout (2× tick interval); 3-strike restart; metric/logging on every restart to detect flapping. |
| **Backend changes out of sync with player** | Med | High | Player treats all backend features as optional and degrades gracefully; contract changes described here are explicitly marked "(separate backend task)". |

---

## 12. Estimated Development Order

A dependency-driven ordering for a single implementer (parallelization noted where safe):

```
1. Phase 0  — Manifest contract adoption + PlayerState skeleton + NetworkMonitor
              (unblocks everything; restores playlist playback immediately)
   └─ can be shipped as a hotfix on its own

2. Phase 1  — CacheStore + IntegrityChecker + DownloadQueue + startup validation
              (foundation for all offline guarantees; no UI yet)

3. Phase 2  — ManifestCoordinator (stage/promote) + manifest_version diffing
              (parallel-safe with Phase 3 once contract is locked)

4. Phase 3  — PlaylistEngine v2 (durations, transitions, scheduling)        ← can overlap with tail of Phase 2

5. Phase 4  — Sidebar UI (cache progress, network, device panels)
              (pure consumer of PlayerState; safe to build once 1–2 land)

6. Phase 5  — PlayerService (foreground) + BootReceiver + Watchdog
              (do last among core: it reshapes lifecycles; benefits from stable managers)

7. Phase 6  — Offline catch-up polish, remote-widget snapshots, PDF, telemetry
```

**Milestones worth gating releases on:**
- *M1 (after Phase 0):* playlists play again. Ship as a fix.
- *M2 (after Phases 1–2):* offline-first cache with non-disruptive updates. Ship as beta to a test group.
- *M3 (after Phases 3–4):* full sequencer + professional sidebar. Ship broadly.
- *M4 (after Phases 5–6):* unattended reliability + offline catch-up. Production-grade.

---

### Appendix — Evidence (key code paths analyzed, read-only)

- `apps/android-player/app/src/main/kotlin/com/nuexis/player/MainActivity.kt` — Activity orchestration; realtime callbacks funnel into `syncSignageContent`; `ConnectivityManager` callback only re-triggers realtime.
- `apps/android-player/app/src/main/kotlin/com/nuexis/player/ContentSyncManager.kt` — single-Asset-only sync; loose-field change detection; inline download in `loadAssetContent`; 30 s offline polling in `startOnlineCheckLoop`.
- `apps/android-player/app/src/main/kotlin/com/nuexis/player/playback/CacheManager.kt` — MD5-path filenames; `exists()&&length>0` validation; `.tmp→rename`; coarse `evictStaleFiles`.
- `apps/android-player/app/src/main/kotlin/com/nuexis/player/playback/MediaEngine.kt` — dual-viewport preload + `transitionToNext()` (solid foundation); WebView widget rendering via `widget_bootstrap.html`.
- `apps/android-player/app/src/main/kotlin/com/nuexis/player/data/SupabaseClient.kt` — REST RPCs; rate limiter; **no** `getManifest()`; secret-based device auth.
- `apps/android-player/app/src/main/kotlin/com/nuexis/player/realtime/RealtimeClient.kt` — raw WS; devices-row + device-pair channels; presence track; 30 s heartbeat; 5 s reconnect.
- `apps/android-player/app/src/main/kotlin/com/nuexis/player/playback/PlaylistEngine.kt` — **deleted in working tree**; basic sequencer that this plan supersedes.
- `apps/android-player/app/src/main/kotlin/com/nuexis/player/diagnostics/DiagnosticsManager.kt` — computes free disk / network type but only ships to server.
- `apps/android-player/app/src/main/AndroidManifest.xml` — Activity + `BootReceiver` only; no foreground service; `MANAGE_EXTERNAL_STORAGE` requested.
- Supabase (live, `dpdabdbqhjkmxvwnukev`): `get_player_manifest()`, `trg_fn_precompute_manifest_version()`, `resolve_device_state()`, `validate_device_session()`, `notify_devices_for_playlist/asset()`, realtime publication on `devices` (incl. `current_manifest_version`). Storage bucket `workspace-media`, paths `<team_id>/<timestamp>-<name>`.

*End of plan. No code, configuration, database migration, backend function, or application logic was modified.*
