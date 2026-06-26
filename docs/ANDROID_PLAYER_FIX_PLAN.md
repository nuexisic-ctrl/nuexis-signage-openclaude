# Android Player — Fix & Implementation Plan

> Scope: issues preventing the Android player from playing **images, videos, widgets,
> and playlists**, from **caching** them, and from being **reliable** in production
> (offline, reconnects, crashes). Each section lists the **issue**, its **root cause**,
> and **how to fix it**.

This document is analysis + plan only. No code has been changed.

---

## 0. Summary of root causes

The player cannot render anything because of a chain of failures, not one single bug:

1. A **compile error** (`withContext` not imported) may be preventing builds of
   `ContentSyncManager.kt` from succeeding at all.
2. **Widget assets have no `file_path` that can be resolved** — the manifest sends the
   widget *config JSON* as `file_path`, and the caching/download pipeline chokes on it.
3. **Media downloads are keyed by a SHA-256 of the file path and stored with no file
   extension**, so ExoPlayer/`ImageView`/`PdfRenderer` cannot infer the container format
   and fail to decode/play.
4. **Integrity validation is effectively disabled** (`expectedSha256` is always passed as
   `""`), so the "are all assets ready" gate is unreliable, and partial/corrupt files are
   accepted.
5. **`ping_device` RPC signature mismatch** — the Kotlin client calls the
   `(p_device_id, p_session_token)` overload but `ContentSyncManager.flushPlaytime` calls
   `incrementPlaytime(deviceId, hardwareId, secret, …)` which hits the *other* overload —
   inconsistencies and the wrong overload at runtime cause 5xx → playback state churn.
6. **Scheduling fields** (`start_time`, `end_time`, `days_of_week`) **do not exist in the
   backend `playlist_items` table**, so the player's scheduling logic always defaults to
   "always active" (harmless today, but a latent bug if the web UI starts setting them).
7. **Single-item playlists never advance / never complete**, and **video items with
   `duration_seconds == 0` rely on an end-of-stream callback that only fires if the file
   decodes** — combined with issue #3, videos silently freeze.
8. **Offline boot path depends on `live.json` existing**, which only exists after a
   successful online promote — first-run-without-network shows nothing.

The backend itself (RPCs, triggers, storage bucket, vault secrets, manifest-version
hashing) is largely sound. The breakage is overwhelmingly on the **client side**, with a
couple of contract mismatches between client and server.

---

## 1. Build / compilation

### 1.1 `withContext` used but not imported
- **File:** `apps/android-player/app/src/main/kotlin/com/nuexis/player/ContentSyncManager.kt`
- **Issue:** `withContext(Dispatchers.IO)` and `withContext(Dispatchers.Main)` are used at
  lines ~100, ~118, and ~238, but the import block (lines 3–18) only imports
  `kotlinx.coroutines.*` — which does **not** include `withContext` on its own in a strict
  resolver setup, and in any case `withContext` requires
  `kotlinx.coroutines.withContext`. If this file currently compiles it is because a
  transitive star-import happens to bring it in; relying on that is fragile and any IDE
  refactor / stricter Kotlin version will break the build.
- **Root cause:** Missing explicit import.
- **Fix:** Add `import kotlinx.coroutines.withContext` to `ContentSyncManager.kt`. Audit
  every other file that calls `withContext` to confirm it is imported explicitly (do the
  same for `delay`, `launch`, `isActive` where used).

### 1.2 Dual `CacheManager` / `CacheStore` confusion
- **Issue:** `playback/CacheManager.kt` is annotated `@Deprecated("Use CacheStore and
  DownloadQueue instead")` but is still **instantiated and passed around** by
  `MainActivity`, `PlayerService`, `ContentSyncManager`, and `PlaylistEngine`. Two parallel
  caching systems therefore exist: the legacy `CacheManager` (used for *playback* lookups)
  and the real `CacheStore` + `DownloadQueue` (used for *downloads*).
- **Why it matters:** `PlaylistEngine.playItemInViewport` calls
  `cacheManager.getCachedFile(asset.file_path)` (the **legacy** path), which only ever
  checks `live`/`staged`/`archive` directories by **key hash with no extension**. The new
  `DownloadQueue` writes into the same key-hashed filenames. The two agree on disk layout
  by accident, but the legacy manager's `downloadAsset` and `evictStaleFiles` are dead
  weight that can race with `CacheStore.promoteStaged`.
- **Fix:** Remove `CacheManager` entirely. Have `PlaylistEngine` resolve files via
  `CacheStore.getCachedFile(key, sha, size)` (the validated path). Delete the legacy
  `downloadAsset`/`evictStaleFiles` methods. Remove the `cacheManager` field from
  `MainActivity`/`PlayerService`/`ContentSyncManager`.

---

## 2. Media cannot play (images / videos / PDFs)

### 2.1 Files are stored without extensions, breaking decoders
- **Files:** `cache/CacheStore.kt` (`getFileForGeneration` returns
  `File(mediaLiveDir, key)` where `key = sha256(filePath)`),
  `cache/DownloadQueue.kt` (writes `File(mediaStagedDir, key)`),
  `playback/PlaylistEngine.kt` (reads via `cacheManager.getCachedFile`).
- **Issue:** Every downloaded asset is stored as a bare 64-char hex hash with **no file
  extension** (e.g. `media/live/d0f61197…`). Then:
  - `ExoPlayer` is given `MediaItem.fromUri(Uri.fromFile(file))` — ExoPlayer sniffs the
    container from the extension first and falls back to content sniffing only for some
    formats; `.mp4`-less files frequently fail to be demuxed.
  - `ImageView.setImageURI` cannot infer the bitmap format from a hash-only name.
  - `PdfRenderer` opens by file descriptor so it tolerates the missing extension, but only
    if the bytes are actually a valid PDF.
- **Root cause:** The cache key derivation throws away the original filename and never
  preserves the extension.
- **Fix:**
  - Store the extension alongside the key. Two clean options:
    1. **Append extension** to the stored filename: `"$key.$ext"` where `ext` is derived
       from `asset.file_name` / `asset.mime_type`. Update `getFileForGeneration`,
       `deriveKey` consumers, and the DB `CacheEntry` (add an `extension` column or derive
       from mime). This is the lowest-risk fix.
    2. Alternatively, keep the bare key but pass an explicit **MIME type** to ExoPlayer
       via `MediaItem.Builder().setUri(...).setMimeType(...)` and load bitmaps via
       `BitmapFactory` with the mime type. This is more invasive.
  - Prefer option 1. Make `deriveKey` return `(key, ext)` or add a helper
    `storedName(key, mime)`.

### 2.2 Integrity gate is disabled → "ready" lies about completeness
- **Files:** `sync/ManifestCoordinator.kt` (calls `downloadQueue.enqueue(...,
  expectedSha256 = "")` and validates with `IntegrityChecker.validate(file, size, "")`),
  `cache/IntegrityChecker.kt` (`validate` returns `true` when `expectedSha256` is blank).
- **Issue:** Because `expectedSha256` is always `""`, the integrity check collapses to a
  **size-only check**. A truncated-but-same-rough-size file, or a 0-byte file alongside a
  0-byte expectation (widgets!), passes validation. This is the core reason playback can
  "start" against a corrupt/empty file and then immediately freeze.
- **Root cause:** The backend `get_player_manifest` does not include a per-asset SHA-256,
  and `assets.size_bytes` can be `0` for widget "assets".
- **Fix:**
  - **Backend:** Add `sha256` to the `assets` table (computed on upload in the web app),
    and include it in the manifest's `asset` object returned by `get_player_manifest` and
    `trg_fn_precompute_manifest_version`.
  - **Client:** Thread `expectedSha256` from `ManifestAsset` through `DownloadQueue.enqueue`
    and `CacheStore.registerStagedAsset`. Tighten `IntegrityChecker.validate` to **fail**
    when `expectedSha256` is blank *and* size > 0 (i.e., treat missing hash as
    untrusted for real media).
  - For widgets (size 0, no file), do **not** enqueue a download at all (see §3).

### 2.3 `pdfJob` uses an unscoped `CoroutineScope(Dispatchers.Main)`
- **File:** `playback/MediaEngine.kt`, `Viewport.playPdf` (line ~217).
- **Issue:** `CoroutineScope(Dispatchers.Main).launch { … }` creates a **new scope each
  call** that is never cancelled on `release()`/config change except via `pdfJob?.cancel()`.
  If `stopVideo()` is not called before `release()`, the render loop leaks and can touch a
  recycled `imageView`.
- **Fix:** Inject a single `CoroutineScope` into `MediaEngine` (or reuse the
  `PlaylistEngine` scope) and launch PDF rendering on it. Cancel it in `Viewport.release`.

### 2.4 WebView widget rendering has no load-timeout / error fallback
- **File:** `playback/MediaEngine.kt`, `Viewport.playWidget`.
- **Issue:** For `application/x-widget-website`/`remote-url`, if the URL hangs or the
  device is offline-without-snapshot, the screen goes blank with only a log line. For
  local widget types, `onPageFinished` is the only trigger for `renderWidget(...)` — if the
  bootstrap HTML fails to fire `onPageFinished` (rare but possible), nothing renders.
- **Fix:**
  - Add a load timeout (e.g. 15 s) after `webView.loadUrl(...)`; on timeout, call
    `showErrorFrame(...)`.
  - Move the `renderWidget(...)` JS call out of `onPageFinished` into a
    `WebViewClient.onPageCommitVisible` + a small delay, or call it directly on a
    `WebView.evaluateJavascript` after `loadUrl("about:blank")` then DOM-inject — the
    current approach works but is brittle.
  - Persist the MHTML snapshot path in the manifest/cache DB so it survives across
    playlist rotations instead of being recomputed each time the widget re-enters.

---

## 3. Widgets never resolve (the "playlists do nothing" case)

### 3.1 Widget `file_path` is actually JSON config, not a path
- **Backend data (confirmed):** widget assets look like:
  - `mime_type = 'application/x-widget-flow'`, `file_path = '{"style":"classic-digital",…}'`
  - `mime_type = 'application/x-widget-website'`, `file_path = 'https://mfarmacy.com/…'`
  - `mime_type = 'application/x-widget-countdown'`, `file_path = '{"text":"Event…"}'`
- **Issue:** The manifest RPC maps a widget `playlist_item` to
  `type = 'widget'`, `asset = { file_path: <the JSON config> }`. But
  `PlaylistEngine.playItemInViewport` for `"widget"` reads
  `item.asset?.mime_type ?: item.widget_type` and
  `item.widget_config?.toString() ?: ""`. **`widget_config` is the JSON column, but the
  actual config often lives in `asset.file_path`** for widget assets created via the
  asset library. So `configJson` ends up empty and the widget renders with defaults or
  nothing.
- **Root cause:** Two sources of truth for widget config (`playlist_items.widget_config`
  vs `assets.file_path`) and the player only reads one.
- **Fix:**
  - In `PlaylistEngine`, when `type == "widget"`: resolve the effective config as
    `item.widget_config ?: (parse asset.file_path as JSON if it starts with '{')`.
    Resolve the effective mime as `item.widget_type ?: item.asset?.mime_type`.
  - Treat `application/x-widget-website` / `remote-url` specially: the "config" may be a
    bare URL string, not JSON. `MediaEngine.playWidget` already handles this, but the
    plumbing from `PlaylistEngine` must pass the **URL string** (or the JSON) faithfully.
  - **Never enqueue a download** for widget items. `ManifestCoordinator.handleNewManifest`
    already filters `type.startsWith("widget")` out of `activeKeys` and `missingAssets`,
    which is correct — keep it, and also short-circuit widget items in
    `PlaylistEngine.playItemInViewport` before any `cacheManager.getCachedFile` call.

### 3.2 `application/x-folder` assets leak into the manifest
- **Confirmed:** there is an asset with `mime_type = 'application/x-folder'`,
  `file_path = 'folder'`. If a playlist item ever points at it, the player will try to
  "play" a folder.
- **Fix:** The web app should never let a folder be added to a playlist. Defensively, the
  player should skip playlist items whose `asset.mime_type` starts with
  `application/x-folder` and log a warning.

---

## 4. Playlist engine logic bugs

### 4.1 Single-item playlists stall
- **File:** `playback/PlaylistEngine.kt`, `scheduleTransitionForCurrentItem` (line ~165).
- **Issue:** When `items.size <= 1`, the method **cancels `playbackJob` and returns**,
  relying on "the player or static display" to keep showing the item. For a single
  **video** with `duration_seconds == 0`, it also returns early waiting for a native
  completion event. That completion event (`onVideoEndedListener`) only fires if ExoPlayer
  actually reaches `STATE_ENDED`. Combined with the extension/integrity bugs above, the
  video never plays → never ends → screen freezes forever. For a single **image**, it
  correctly stays static, but for a single **widget** there is no duration handling at all.
- **Fix:**
  - For single-item widgets, still apply `duration_seconds` if > 0 (rotate even though
    there's nothing to rotate to — at least re-init the widget, which can recover from a
    stuck state).
  - For single-item video with `duration_seconds == 0`, set a fallback watchdog: if
    `STATE_READY`/`STATE_ENDED` is not seen within N seconds, treat it as ended and re-init.
  - Decouple "advance" from "ExoPlayer ended" by always arming a max-duration timer.

### 4.2 Failed item skip can infinite-loop with no backoff cap
- **File:** `playback/PlaylistEngine.kt`, `playCurrentItem` (line ~149).
- **Issue:** When `playItemInViewport` returns `false`, it `delay(1000)`s then
  `advanceToNext()`. If **every** item fails (e.g., all assets missing because of the
  download/integrity bugs), this loops forever once per second, spamming logs and burning
  CPU/battery.
- **Fix:** Track consecutive failures; after N (e.g. 3) full loops with zero successes,
  stop the engine, show an error frame, and surface the condition through
  `PlayerStateHolder` / diagnostics. Retry on the next sync or network event.

### 4.3 `getActiveItems` falls back to "all items" when nothing is scheduled
- **File:** `playback/PlaylistEngine.kt`, `getActiveItems` (line ~128).
- **Issue:** `return if (activeItems.isEmpty()) allItems else activeItems`. This is a
  design choice, but it means scheduling is silently ignored when the schedule excludes
  everything — the player shows content at times it should be blank.
- **Fix:** Decide on product behavior. If "show nothing outside schedule" is desired,
  return `activeItems` (possibly empty) and render a black frame when empty. If "fallback
  to all" is desired, keep as-is but document it. Either way, the scheduling fields must
  actually exist in the backend (see §6.2) before this matters.

### 4.4 Native video-end handler ignores non-video with duration 0
- **File:** `playback/PlaylistEngine.kt` init block (line ~37).
- **Issue:** The `onVideoEndedListener` only transitions when
  `currentItem.type == "video" && duration_seconds == 0`. If a video item has
  `duration_seconds > 0`, both the timer (§4.1) and the native end event can race,
  causing a double-advance (skipping an item).
- **Fix:** Make the two transition paths mutually exclusive: when `duration_seconds > 0`,
  ignore the native end event (or use it only to loop within the same item).

---

## 5. Caching & download pipeline

### 5.1 No file extension on disk (cross-ref §2.1)
- Already covered. This is both a playback bug and a caching bug: the cache stores files
  ExoPlayer/ImageView cannot consume.

### 5.2 `IntegrityChecker` disabled (cross-ref §2.2)
- Already covered. The cache marks corrupt/empty files as ready.

### 5.3 Resumable downloads assume server supports `Range`
- **File:** `cache/DownloadQueue.kt` (line ~194, `Range: bytes=$bytesDownloaded-`).
- **Issue:** Supabase Storage **signed URLs do support range requests**, but if the URL is
  generated fresh each attempt and the response comes back as `200` (not `206`), the code
  correctly resets `bytesDownloaded = 0` — but it does **not delete the existing `.part`
  file's stale tail**. Actually it does `partFile.delete()` on the `!isPartial` branch,
  so this is handled. However, when a fresh signed URL is requested mid-download, the old
  URL may have expired; the retry path requests a **new** signed URL via `getSignedUrl`
  (good) but there's no test that the new URL honors the same byte offset semantics.
- **Fix:** Verify Supabase Storage signed-URL range behavior; if unreliable, drop resume
  and always re-download from 0 for simplicity (media files are small in practice). Keep
  resume only if validated.

### 5.4 `DownloadQueue` worker can silently stop and never restart
- **File:** `cache/DownloadQueue.kt`, `runQueueProcessor` breaks when `getNextPending()`
  returns null. A new `enqueue` calls `startWorkerIfNeeded`, which is correct. But if the
  process dies between an enqueue and the worker launching, the only recovery is
  `StartupValidator` resuming PENDING/RETRYING/DOWNLOADING tasks — which it does.
  However, tasks left in `DOWNLOADING` state across a crash are **not reset to PENDING**
  on startup, so `getNextPending()` (which selects `PENDING`/`RETRYING`) will never
  pick them up again.
- **Fix:** In `StartupValidator.validateAtStartup`, reset all `DOWNLOADING` rows to
  `PENDING` (clearing any stale `bytesDownloaded` cross-check) so the worker re-pulls them.

### 5.5 Disk-full state is terminal until manual recovery
- **File:** `cache/DownloadQueue.kt` sets `isQueuePaused = true` on low disk and marks the
  task `FAILED` with "Disk space low", and `updateOverallProgress(CacheStatus.DISK_FULL)`.
- **Issue:** Nothing un-pauses the queue after space is freed (e.g. after eviction or user
  cleanup). `isQueuePaused` is only reset inside `startWorkerIfNeeded` when a *new* worker
  is spun up — which won't happen because the queue looks failed.
- **Fix:** On network-reconnect or on a periodic timer, if `CacheStatus == DISK_FULL` and
  free space has recovered above threshold, reset `isQueuePaused` and re-enqueue/`startWorker`.
  Surface `DISK_FULL` prominently in diagnostics and the UI.

### 5.6 No LRU cap on the live cache (only archive is evicted)
- **File:** `cache/CacheStore.kt`, `evictIfNeeded` only evicts `archive` generation.
- **Issue:** If a device accumulates many large live assets across manifest versions, the
  live set can grow unbounded (each promote moves old live → archive, but if the same
  assets keep coming back they stay live). Long-term this risks disk exhaustion on small
  players.
- **Fix:** Add a configurable max cache size; when exceeded, evict the
  least-recently-used **archive** entries first (already done), and if still over, warn.
  Do not evict `live` entries that are in the current manifest.

---

## 6. Client/server contract mismatches

### 6.1 `ping_device` / `increment_device_playtime` overload confusion
- **Confirmed in DB:** there are **two** `ping_device` overloads:
  - `ping_device(p_device_id uuid, p_session_token text)`
  - `ping_device(p_device_id uuid, p_hardware_id text, p_secret text)`
- **Client:** `ContentSyncManager.startStatusTracking` calls
  `supabaseClient.pingDevice(deviceId, sessionToken)` (2-arg, session variant — good).
  But `flushPlaytime` calls
  `supabaseClient.incrementPlaytime(deviceId, hardwareId, secret, seconds)`, which maps to
  `increment_device_playtime(p_device_id, p_hardware_id, p_secret, p_seconds)` — the
  **secret-based** variant, not the session-based one. This is inconsistent with the rest
  of the post-session-exchange flow and means playtime reporting breaks if the device
  secret ever rotates.
- **Fix:** Standardize on **session-token** auth for all post-pairing RPCs. Either:
  - Add a session-based `increment_device_playtime(p_device_id, p_session_token, p_seconds)`
    and use it, or
  - Keep the secret-based one but call it consistently and stop mixing the two.
  Prefer the session variant for forward compatibility.

### 6.2 Scheduling fields absent from `playlist_items`
- **Confirmed:** the `playlist_items` table has **no** `start_time`, `end_time`, or
  `days_of_week` columns. Yet `SupabaseClient.ManifestPlaylistItem` declares them and
  `PlaylistEngine.isScheduledActive` reads them.
- **Issue:** Today this is harmless (Gson leaves them null → "always active"). But the web
  app's "scheduling" feature, if it ever writes these, will silently lose them because the
  columns don't exist, and the manifest RPC doesn't select them.
- **Fix (when scheduling is actually needed):**
  - **Backend:** add `start_time time`, `end_time time`, `days_of_week int2[]` (or
    `boolean[7]`) to `playlist_items`; include them in `get_player_manifest`'s
    `jsonb_build_object` for playlist items and in
    `trg_fn_precompute_manifest_version`'s hash input (otherwise schedule changes won't
    bump the manifest version and the player won't re-sync).
  - **Client:** already supports them once present.

### 6.3 `report_device_health` has two overloads; client may hit the wrong one
- **Confirmed:** `report_device_health` exists with two signatures (one with trailing
  `p_cache_percent`/`p_cache_status`, one without). The Kotlin client passes both, so it
  resolves to the longer overload — fine — but the duplicate definition is a maintenance
  hazard.
- **Fix:** Drop the shorter overload from the DB (or mark it deprecated). Keep the
  longer one with both cache fields default-NULL.

---

## 7. Reliability & lifecycle

### 7.1 Service/viewport reattach can lose the media engine
- **File:** `service/PlayerService.kt` `attachViewport` / `MainActivity.onResume`.
- **Issue:** `attachViewport` only calls `initMediaEngine` if `currentEngine == null`.
  When the Activity is recreated (rotation, memory pressure), `onResume` reattaches the
  viewport; if the engine survived in the service, it re-parents the view tree. But
  ExoPlayer/WebView instances bound to a destroyed Activity's context can throw. The
  `Viewport.release` does `webView.destroy()` and `removeView`, which helps, but the
  two-viewport (A/B) preload swap means a half-destroyed preload viewport can NPE on
  transition.
- **Fix:**
  - On `detachViewport`, pause playback (`playlistEngine.stop()`, `mediaEngine.stopAll()`)
    but keep the engine alive. On `attachViewport`, re-parent and resume from the current
    manifest (`playlistEngine.start(currentManifest)`).
  - Guard `transitionToNext` against a null/released preload viewport.

### 7.2 Watchdog can restart the engine with a stale manifest
- **File:** `service/PlayerService.kt` watchdog `onRestartEngine` calls
  `playlistEngine.start(manifest)` using `currentManifest`. If the manifest is stale
  (e.g., the coordinator never promoted a new one because downloads failed), the watchdog
  just re-plays the same broken state.
- **Fix:** On watchdog engine restart, also trigger a fresh `manifestCoordinator.sync()`
  so the player re-evaluates downloads instead of looping on a bad manifest.

### 7.3 Realtime reconnect uses raw `Thread.sleep` and can stack
- **File:** `realtime/RealtimeClient.kt`, `reconnect()` spawns a `Thread { sleep(5000);
  connect() }`. `joinPresenceChannel` spawns another `Thread { sleep(5000); track() }`.
- **Issue:** Multiple reconnect attempts can stack if `onFailure` fires repeatedly before
  the first reconnect completes (guarded partially by `isConnecting`, but not fully across
  threads). Leaked threads on a long-running signage device accumulate.
- **Fix:** Replace raw threads with a single `ScheduledExecutorService` or a coroutine in
  the service scope. Use exponential backoff for reconnect.

### 7.4 `fallbackToDestructiveMigration` on Room
- **File:** `data/db/PlayerDatabase.kt`.
- **Issue:** `fallbackToDestructiveMigration()` means any future schema change wipes the
  cache DB (and thus all downloaded media metadata) on update. For a signage player that
  may re-download gigabytes, this is dangerous.
- **Fix:** Remove `fallbackToDestructiveMigration`. Write real migrations for any schema
  bump (e.g., when adding the `extension`/`sha256` columns from §2.1/§2.2).

### 7.5 First-run offline has no content
- **File:** `ContentSyncManager.startOfflinePlaybackFromCache` only proceeds if
  `getCachedContentType()` is set, which only happens after a successful online promote.
- **Issue:** A brand-new device that boots without network shows a blank/loading screen
  indefinitely with no clear messaging.
- **Fix:** This is acceptable behavior (there's genuinely nothing to play), but the UI
  should show a clear "Connect to the internet to receive content" frame instead of a
  generic loader, and retry network detection aggressively.

### 7.6 Wake lock only held during DOWNLOADING/VALIDATING
- **File:** `service/PlayerService.kt` `updateWakeLock`.
- **Issue:** During active **playback** of a long video with the screen on, the player
  relies on `FLAG_KEEP_SCREEN_ON` (set in `MainActivity.onCreate`). That's fine while the
  Activity is foregrounded, but if the service ever plays headless (future), playback
  could be dozed.
- **Fix:** For now, document that the Activity must stay foregrounded. If headless
  playback is ever needed, acquire a `PARTIAL_WAKE_LOCK` during playback too and use a
  `MediaSession` for proper media-style foreground service typing.

---

## 8. Diagnostics & observability (enables finding the next bugs)

### 8.1 `currentItemIdGetter` always returns null
- **File:** `service/PlayerService.kt` `startDiagnostics` passes
  `currentItemIdGetter = { null }`.
- **Issue:** Health events never include the currently-playing item, so server-side
  debugging of "why did this screen go black" is blind to the item context.
- **Fix:** Wire it to `playlistEngine` current item id. Add a getter on `PlaylistEngine`
  for the active `ManifestPlaylistItem.id`.

### 8.2 `reportPlaybackEvent` is never called
- **File:** `SupabaseClient.reportPlaybackEvent` exists, `device_playback_events` table
  exists with **0 rows**, and nothing in the player invokes it.
- **Fix:** Emit playback events (item start, item end, error, skip) from
  `PlaylistEngine` via `reportPlaybackEvent`. This gives server-side visibility into
  exactly which items fail — essential for diagnosing §2/§3 in the field.

---

## 9. Recommended fix order

This ordering minimizes "did I fix it?" noise — each step unblocks validating the next.

1. **Build hygiene (§1.1, §1.2)** — fix imports, remove legacy `CacheManager`. Confirm a
   clean release build installs and pairs.
2. **Cache file extensions (§2.1)** — store `key.ext`; this alone will make images and
   videos decode.
3. **Widget config resolution (§3.1, §3.2)** — read config from the right source; skip
   folder widgets. Validates that widget playlists render at all.
4. **Integrity gate (§2.2)** — thread real SHA-256 from backend to client; tighten
   validator. Stops "ready but corrupt" files.
5. **Playlist engine correctness (§4.1–§4.4)** — single-item stalls, double-advance,
   failure backoff. Now multi-item playlists rotate correctly.
6. **Download queue robustness (§5.3–§5.5)** — reset DOWNLOADING on startup, recover from
   DISK_FULL, validate range-resume.
7. **Contract cleanup (§6.1, §6.3)** — pick one auth overload per RPC; drop duplicates.
8. **Reliability hardening (§7.1–§7.4)** — viewport reattach, watchdog-triggered resync,
   realtime executor, real Room migrations.
9. **Observability (§8.1, §8.2)** — wire `currentItemId`, emit playback events. Needed to
   trust that 1–8 actually work in production.
10. **Scheduling fields (§6.2)** — only when the web product introduces per-item
    scheduling; add columns + include in manifest hash.

---

## 10. What is already correct (do not rework)

- **Manifest version hashing:** `trg_fn_precompute_manifest_version` correctly includes
  content_type, asset_id, playlist_id, orientation, and the serialized item list in the
  SHA-256, so any real content change bumps the version and the player re-syncs.
- **Playlist-change notification:** `trg_fn_on_playlist_item_change` →
  `notify_devices_for_playlist` bumps `updated_at` on affected devices, which fires the
  manifest-version trigger. The realtime channel then delivers the change.
- **Storage bucket:** `workspace-media` is private (`public=false`) and signed URLs are
  minted server-side via the vault-stored service role key — the security model is sound.
- **Rate limiting & session validation:** `RateLimiter` on the client and
  `validate_device_session` on the server are correctly implemented.
- **Generation-based cache (live/staged/archive) + promote-on-ready:** the design is
  correct; only its inputs (extension, sha256) and a couple of edge cases are broken.
- **Watchdog concept:** playback/realtime watchdogs with escalating recovery (engine →
  realtime → service restart) is the right shape; just needs the resync tweak (§7.2).
