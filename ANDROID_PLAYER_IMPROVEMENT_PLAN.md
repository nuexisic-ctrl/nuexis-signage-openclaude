# Android Player Improvement Plan & Production Readiness Assessment

## 1. Executive Summary

A comprehensive technical audit of the NuExis Android Player (`apps/android-player`) codebase has been conducted to determine the root causes of current content rendering failures and to establish a roadmap for production readiness.

The audit reveals severe architectural flaws in the UI layer, playback engine, state management, and media handling that prevent the player from successfully rendering continuous content. Most notably, unchecked coroutine proliferation, synchronous main-thread media decoding, and incorrect usage of the Media3 `PlayerView` component cause skipped items, ANRs (Application Not Responding), and jarring transitions.

This document outlines the detailed findings, their root causes, and provides a prioritized, actionable roadmap to transform the Android Player into a stable, highly performant, production-grade application suitable for continuous kiosk deployment.

---

## 2. Current Issues Analysis & Root Cause Investigation

### 2.1 Overlapping Coroutines Causing Rapid Playlist Skipping
* **Description:** After a few items in a playlist have played, the player begins skipping through content uncontrollably, jumping past items before their duration is met.
* **Root Cause:** In `PlayerFragment.kt`, `handleUiState` launches a new unmanaged coroutine (`viewLifecycleOwner.lifecycleScope.launch`) every time an Image or Website is rendered, which calls `delay()` and then `viewModel.advanceToNext()`. If a playback error occurs, or if the user forces a skip, the previously delayed coroutine is never cancelled. These "ghost" coroutines accumulate and fire randomly, causing rapid, unintended state advances.
* **Affected Modules:** `PlayerFragment.kt`, `PlayerViewModel.kt`
* **Impact:** Critical (Destroys the playlist timing completely)

### 2.2 Synchronous Main-Thread Image Loading (OOM & ANRs)
* **Description:** The player freezes or crashes when attempting to load high-resolution (e.g., 4K) image assets.
* **Root Cause:** `PlayerFragment.kt` uses `binding.imageView.setImageURI(Uri.parse(state.uri))` for image playback. This Android framework method synchronously decodes the file from the disk directly on the UI thread. For large digital signage assets, this immediately blocks the main thread, leading to ANRs, and decodes the full unscaled bitmap into memory, causing `OutOfMemoryError` (OOM).
* **Affected Modules:** `PlayerFragment.kt`
* **Impact:** Critical (Immediate app crash on high-res images)

### 2.3 Broken Video Seamless Transitions (Black Screens between Videos)
* **Description:** There is a visible black screen/flicker between consecutive video assets, failing to achieve the designed seamless transition.
* **Root Cause:** While `PlaybackManager.kt` correctly manages two `ExoPlayer` instances (active and background) to preload the next video, `PlayerFragment.kt` does not utilize the two UI views (`playerViewActive` and `playerViewBackground`) correctly. It simply binds the newly active `ExoPlayer` to the single `playerViewActive` component. Rebinding a `Player` to a `PlayerView` forces the view to reset its surface, dropping the frame and causing a black flash. The view opacity/z-index crossfade logic mentioned in the architecture document is missing entirely.
* **Affected Modules:** `PlayerFragment.kt`, `PlaybackManager.kt`
* **Impact:** High (Poor visual experience)

### 2.4 Unmanaged WebView Lifecycle and Memory Leaks
* **Description:** Playing multiple Website/Widget assets causes the app to progressively consume more memory until it crashes. Audio from previous web pages continues playing even after the UI switches to a video or image.
* **Root Cause:** The `WebView` in `PlayerFragment.kt` is merely hidden (`visibility = View.GONE`) when transitioning away from `PlayerUiState.PlayingWebsite`. Its lifecycle (`onResume`, `onPause`, `destroy`) is not linked to the playback state, meaning background JavaScript loops and HTML5 audio tags continue executing indefinitely.
* **Affected Modules:** `PlayerFragment.kt`
* **Impact:** High (Memory leak and audio bleeding)

### 2.5 Infinite Recursive Skip Loop on Playback Failure
* **Description:** If a corrupt asset or unreachable widget URL is encountered in a playlist of broken assets, the application freezes entirely.
* **Root Cause:** In `PlayerViewModel.kt`, if an item fails to play, it catches the exception, increments `skipCount`, and immediately calls `advanceToNext()`. If all items are broken, this results in rapid, unbounded synchronous recursion, leading to a `StackOverflowError` or thread starvation.
* **Affected Modules:** `PlayerViewModel.kt`
* **Impact:** High (App crash)

### 2.6 Insufficient Network & Media Error Recovery
* **Description:** Unstable internet or intermittent file system issues cause permanent playback halts until the app is manually restarted.
* **Root Cause:** ExoPlayer's `Player.Listener.onPlayerError` sets the state to `PlaybackState.Error`. `PlayerViewModel` catches this but often drops the state without properly logging the diagnostic error or scheduling an automatic retry with exponential backoff.
* **Affected Modules:** `PlaybackManager.kt`, `PlayerViewModel.kt`
* **Impact:** High (Prevents offline resilience and self-healing)

---

## 3. Recommended Fixes

### 3.1 Fixing Content Playback & Synchronization (Coroutines)
* **Technical Fix:** Introduce a `Job` reference in `PlayerFragment` (or manage state progression strictly inside the `ViewModel`). Cancel any existing `advanceJob` before launching a new delay coroutine for Images and Websites.
  ```kotlin
  private var advanceJob: Job? = null
  // Inside handleUiState:
  advanceJob?.cancel()
  advanceJob = viewLifecycleOwner.lifecycleScope.launch {
      delay(state.durationSeconds * 1000L)
      viewModel.advanceToNext()
  }
  ```

### 3.2 Fixing Image Rendering
* **Technical Fix:** Replace `setImageURI` with a robust image loading library like **Coil** or **Glide**. These libraries handle asynchronous background decoding, disk caching, and memory pooling automatically.
  ```kotlin
  binding.imageView.load(File(state.uri)) {
      crossfade(true)
      size(ViewSizeResolver(binding.imageView)) // Prevent OOM by downscaling
  }
  ```

### 3.3 Fixing Video Playback (Seamless Transitions)
* **Technical Fix:** Implement the true double-buffering UI logic. Connect `exoPlayer1` permanently to `playerViewActive` and `exoPlayer2` permanently to `playerViewBackground`. When swapping, crossfade the `alpha` or `visibility` of the two `PlayerView` components themselves, rather than hot-swapping the `Player` instances inside a single view.

### 3.4 Fixing Widget Execution & WebView Lifecycle
* **Technical Fix:** Create a dedicated WebApp/Widget manager. When the widget finishes its duration, explicitly call `binding.webView.loadUrl("about:blank")`, `binding.webView.clearHistory()`, and `binding.webView.onPause()` to halt JavaScript execution and audio playback.

### 3.5 Fixing Error Recovery & Playlist Recursion
* **Technical Fix:** Add a coroutine delay (e.g., `delay(1000)`) inside the error handling block of `playCurrentItem()` before advancing to the next item, breaking the synchronous recursive loop. Reset the `skipCount` after a full valid loop, not just arbitrarily.

---

## 4. Production Readiness Improvements

To elevate the player from a prototype to a production-grade digital signage application, the following system-wide improvements are required:

### 4.1 Architecture
* **Decouple Playback State:** Move the "delay and advance" logic entirely into the `PlayerViewModel` using Coroutine Tickers or Flow. The `Fragment` should be incredibly dumb, only reacting to absolute state emissions ("Show Video X", "Show Image Y").
* **Dependency Injection Validation:** Ensure Hilt bindings are correctly scoping singletons (like `PlaybackManager` and `SyncRepository`) so they aren't recreated on activity configuration changes.

### 4.2 Reliability
* **ExoPlayer Watchdog:** Implement a timeout watchdog. If ExoPlayer reports `STATE_BUFFERING` for more than 10 seconds on a local file, forcefully reset the player and skip the asset.
* **Storage Eviction Policy:** Implement an `AssetCleanupWorker` that runs daily to purge orphaned files from internal storage that no longer belong to active playlists, preventing the 100% disk full state.

### 4.3 Performance
* **Hardware Decoding Enforcement:** Configure ExoPlayer's `DefaultRenderersFactory` to strongly prefer hardware decoding (`EXTENSION_RENDERER_MODE_OFF`).
* **SurfaceView Usage:** Ensure both `PlayerView` XML declarations use `app:surface_type="surface_view"` instead of `texture_view` to drastically reduce memory bandwidth and heat generation during 4K playback.

### 4.4 Monitoring & Observability
* **Crashlytics / Sentry Integration:** Integrate a crash reporting tool to track ANRs and unhandled exceptions globally.
* **Telemetry Syncing:** The `StructuredLogger` currently writes to a local file or standard logcat. This must be batched and synced to the Supabase backend (e.g., via a new `TelemetryWorker`) so admins can view device health from the web dashboard.

### 4.5 Security
* **Network Security Configuration:** Strict enforce HTTPS-only traffic and implement certificate pinning for the Supabase API endpoints to prevent Man-in-the-Middle (MitM) attacks.
* **WebView Sandbox:** Disable `setAllowFileAccess` and `setAllowContentAccess` on the `WebView` unless explicitly required, to prevent malicious widgets from reading local local device secrets.

---

## 5. Testing Strategy (Gaps & Recommendations)

The Android repository currently lacks a comprehensive test suite. The following must be implemented:

1. **Unit Tests (JUnit + MockK):**
   * **`PlayerViewModel`:** Test the playlist logic. Assert that `advanceToNext` correctly cycles indexes. Assert that corrupted item skips do not recurse infinitely.
   * **`SyncRepository`:** Test the parsing and diffing logic when receiving new JSON payloads from Supabase.
2. **Integration Tests:**
   * **Room Database:** Test `DeviceDao` and `PlaylistDao` migrations and CRUD operations.
   * **WorkManager:** Use `WorkManagerTestInitHelper` to verify that `DownloadWorker` correctly triggers, pauses, and resumes downloads.
3. **UI / E2E Tests (Espresso):**
   * Write Espresso tests for the `PairingFragment` to ensure the pairing code is displayed and the UI transitions to `PlayerFragment` upon successful registration.
4. **Stress & Device Compatibility Tests:**
   * Use Firebase Test Lab to run a 24-hour monkey test on a low-end Android TV device (e.g., Chromecast with Google TV) to identify long-term memory leaks and thermal throttling.

---

## 6. Prioritized Roadmap

### Phase 1: Critical Fixes (Immediate Action required)
**Goal:** Achieve stable, continuous playback of mixed media playlists.
* **Task:** Fix Coroutine leak in `PlayerFragment.kt` delay logic.
  * Priority: High
  * Estimated Effort: 1 Day
  * Impact: Critical - prevents rapid playlist skipping and stabilizes timing.
  * Dependencies: None
* **Task:** Integrate Coil/Glide for asynchronous Image rendering.
  * Priority: High
  * Estimated Effort: 1 Day
  * Impact: Critical - prevents OOM crashes and UI thread blocking.
  * Dependencies: None
* **Task:** Implement true dual-view crossfade for seamless Video transitions in `PlayerFragment.kt`.
  * Priority: High
  * Estimated Effort: 2 Days
  * Impact: High - vastly improves visual user experience.
  * Dependencies: None
* **Task:** Fix `WebView` lifecycle and memory leaks.
  * Priority: High
  * Estimated Effort: 1 Day
  * Impact: High - prevents memory exhaustion and background audio bleeding.
  * Dependencies: None
* **Task:** Break recursive error loops in `PlayerViewModel.kt`.
  * Priority: Medium
  * Estimated Effort: 1 Day
  * Impact: High - prevents application crashes from infinite loops.
  * Dependencies: None

### Phase 2: Stability & Reliability Improvements
**Goal:** Ensure the app can survive network drops, bad files, and run for 7 days continuously without crashing.
* **Task:** Implement Storage Eviction & Cleanup Workers.
  * Priority: High
  * Estimated Effort: 2 Days
  * Impact: High - prevents disk full errors and ensures continuous operation.
  * Dependencies: Phase 1 critical fixes.
* **Task:** Add strict hardware decoding & `SurfaceView` configuration.
  * Priority: Medium
  * Estimated Effort: 1 Day
  * Impact: Medium - improves performance and reduces thermal load.
  * Dependencies: True dual-view crossfade implementation.
* **Task:** Implement ExoPlayer buffering watchdog and graceful error recovery.
  * Priority: Medium
  * Estimated Effort: 2 Days
  * Impact: High - enables self-healing and offline resilience.
  * Dependencies: Break recursive error loops.

### Phase 3: Production Readiness & Deployment
**Goal:** Observability, Security, and Enterprise features.
* **Task:** Set up CI/CD pipeline with unit test enforcement.
  * Priority: High
  * Estimated Effort: 2 Days
  * Impact: High - ensures code quality and prevents regressions.
  * Dependencies: None
* **Task:** Integrate Sentry/Crashlytics for remote telemetry.
  * Priority: Medium
  * Estimated Effort: 1 Day
  * Impact: Medium - provides actionable insights into app health.
  * Dependencies: None
* **Task:** Add Firebase Test Lab stress tests.
  * Priority: Low
  * Estimated Effort: 2 Days
  * Impact: Medium - validates long-term stability and device compatibility.
  * Dependencies: CI/CD pipeline setup.

---

## 7. Definition of Done for Production Release

The Android Player will be considered Production Ready when:
1. **Zero ANRs or OOMs** occur when playing a mixed 4K Video/Image playlist on a 2GB RAM Android TV device for 72 continuous hours.
2. **Seamless Transitions** are visually confirmed between consecutive video assets (no black flashes).
3. **Network Resilience** is proven: The player continues looping cached content indefinitely if Wi-Fi is disconnected, and automatically resumes background downloading when reconnected.
4. **Memory Profile** is stable: Memory consumption remains flat over 24 hours of playing Website Widgets, proving no `WebView` leaks.
5. **Test Coverage** reaches a minimum of 60% for domain and logic layers.
6. **Telemetry** correctly reports `last_seen` and crash data to the admin dashboard.

## 8. Risk Assessment

* **Hardware Fragmentation:** Android TV boxes vary wildly in codec support. Mitigation: Rely on ExoPlayer's software fallback if hardware decoding fails, and profile extensively.
* **Thermal Throttling:** Continuous 4K playback can overheat fanless devices. Mitigation: Efficient memory use, SurfaceView, and allowing devices to sleep the screen based on schedule.
* **Storage Exhaustion:** Device storage filling up due to large assets. Mitigation: Implement aggressive cache eviction, size calculation prior to download, and stream assets if storage is full.
* **Network Instability:** Unstable connections interrupting syncs and downloads. Mitigation: Implement robust retry mechanisms with exponential backoff and resume capabilities for downloads.
