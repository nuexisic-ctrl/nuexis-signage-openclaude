# NuExis Android Player: Architecture & Design Document

## 1. Executive Summary
This document outlines the architecture, design, and implementation strategy for the NuExis Android Player. The goal is to build a fully native, enterprise-grade digital signage player runtime that replaces the current WebView-based web player. It will support 4K media, robust offline playback, intelligent asset caching, hardware acceleration, and persistent realtime sync with the Supabase backend.

## 2. Core Architecture
The application will follow **Clean Architecture** principles combined with **MVVM** (Model-View-ViewModel), leveraging modern Android development practices: Kotlin, Coroutines, Flow, Jetpack Compose (for pairing/settings UI), and Media3 (ExoPlayer) for native rendering.

### 2.1 Module Structure
The project will be structured into multiple Gradle modules for separation of concerns and build optimization:
* `:app` - Application entry point, DI setup, base Application class.
* `:core:network` - Supabase clients, REST/RPC API definitions.
* `:core:database` - Room database setup, DAOs, local schemas.
* `:core:domain` - Use cases, domain models, repository interfaces.
* `:core:media` - Media3/ExoPlayer wrappers, hardware codecs, video/image decoders.
* `:feature:player` - The main signage runtime surface, playlist engine, transition logic.
* `:feature:pairing` - Onboarding UI, code generation, pairing flow.
* `:feature:sync` - Background WorkManagers, download queues, cache eviction.

### 2.2 Clean Architecture Layers
* **Presentation Layer (MVVM):** ViewModels exposing `StateFlow` to the UI. The UI reacts strictly to state changes.
* **Domain Layer:** Pure Kotlin modules containing Business Logic (Use Cases) and Repository Interfaces. 
* **Data Layer:** Implementations of Repositories coordinating between `RemoteDataSource` (Supabase RPCs) and `LocalDataSource` (Room DB, File System).

### 2.3 Dependency Injection Architecture
**Hilt / Dagger** will be used for dependency injection. Scopes will be strictly managed:
* `@Singleton` for Database, SupabaseClient, WorkManager instances.
* `@ViewModelScoped` for specific playback state managers.
* WorkerFactory injection for WorkManager classes.

## 3. Database Interactions & Local Persistence

### 3.1 Local Database Schema (Room)
To support offline-first capabilities, the app will mirror the required subset of the Supabase backend in a local SQLite database using Room.

* **`DeviceEntity`**: Hardware ID, Secret, Team ID, Content Type (Asset/Playlist), current Asset ID / Playlist ID, Orientation.
* **`PlaylistEntity`**: ID, Name, Last Updated.
* **`PlaylistItemEntity`**: ID, Playlist ID, Type, Asset ID, Widget Config, Duration, Sort Order.
* **`AssetEntity`**: ID, File Path, Mime Type, Size, Local File URI, Download Status (`PENDING`, `DOWNLOADING`, `COMPLETED`, `FAILED`).
* **`TelemetryEntity`**: Queue for storing playtime metrics or heartbeats while offline, to be batched and synced when online.

### 3.2 Offline-First Caching Architecture & Sync Engine
* **Single Source of Truth:** The UI reads only from the Room Database (`LocalDataSource`) via `Flow`. 
* **Sync Engine:** A dedicated `SyncRepository` listens to Realtime events and polling fallbacks. When updates occur, it fetches new data, updates Room, and schedules `DownloadWorker`s for new assets.
* **Download Manager:** Uses Android's `WorkManager` with `NetworkType.UNMETERED` or `CONNECTED` constraints. Capable of resuming interrupted downloads (using HTTP range requests if supported).

### 3.3 Storage Management & Cache Eviction
* Downloaded assets reside in `Context.filesDir` (or external storage if large capacity is needed and permissions granted).
* **Eviction Policy:** When a playlist sync removes an asset, or when storage drops below 10%, an `AssetCleanupWorker` deletes files associated with orphaned `AssetEntity` records.

## 4. Playback Engine Design

### 4.1 Native Android App Architecture
The signage runtime will utilize a native `Activity` configured for immersive full-screen mode (Kiosk Mode). 
* **No WebViews for Media:** Video and Image playback will use native SurfaceViews.
* **Media3 / ExoPlayer:** The core of the playback engine. 

### 4.2 Playback State Management & Playlist Scheduling Engine
* A `PlaybackManager` (Singleton) holds the current playlist state.
* It calculates the next item, preloads it in the background, and coordinates UI transitions.
* **Looping & Scheduling:** Driven by Kotlin Coroutines (`delay`). If an item is a 10s video, ExoPlayer's completion listener triggers the transition. If an image, a coroutine suspends for `duration_seconds`.

### 4.3 4K Playback Architecture & Hardware Optimization
* **Hardware-Accelerated Decoding:** ExoPlayer will be configured to prioritize `MediaCodec` hardware decoders (`MediaCodecVideoRenderer`).
* **Memory-Efficient Buffering:** `DefaultLoadControl` will be tuned for high-bitrate 4K files, increasing minimum buffer sizes to prevent stuttering.
* **Surface Rendering:** Use `SurfaceView` over `TextureView` for 4K video to save memory bandwidth and avoid frame drops, as `SurfaceView` punches a hole in the window and renders directly via the GPU.
* **4K Images:** Large images will be decoded using `BitmapRegionDecoder` or `ImageDecoder` with downsampling if the display is not true 4K, preventing `OutOfMemoryError` (OOM).

### 4.4 Transitions
* **Double Buffering:** Two `PlayerView` (or `ImageView`) instances overlapping in a `FrameLayout`. While View A plays, View B prepares the next asset. Upon completion, a `Crossfade` animation swaps their opacities and z-indices.

## 5. Supabase Realtime & Presence Integration

### 5.1 Realtime Synchronization Architecture
* The app establishes a WebSocket connection to Supabase Realtime using the Postgres Changes or Broadcast channels.
* Subscribes to `playlist-broadcast-${playlistId}` (as in the web app) to trigger immediate `SyncWorker` jobs.
* **Presence:** Used for Device Health Monitoring. The device joins a presence channel `team-status:${teamId}` (same as the web player) to appear "online" instantly.

### 5.2 Database API Interaction Layer
* **RPCs over REST:** The Android app will use the Supabase Kotlin/Java SDK or Retrofit to call the existing security-definer RPCs: `register_player_device`, `get_player_device_state`, `increment_device_playtime`, etc.
* **Authentication:** Stores the `hardware_id` and `secret` securely. Uses them as parameters for RPCs. For storage, it requests signed URLs from the backend via `get_player_device_state` validation.

## 6. Device Provisioning & Pairing Flow

1. **First Launch:** App generates a unique `hardwareId` (using Android ID or UUID stored in EncryptedSharedPreferences) and a 6-character `pairingCode`.
2. **Display:** UI shows the pairing code.
3. **Registration:** App loops/polls `register_player_device` (or listens via Realtime) until the user claims the device on the web dashboard.
4. **Claimed:** RPC returns a `secret`. The app stores this in `EncryptedSharedPreferences`.
5. **Session:** App enters `Paired` state, fetches assigned content, starts sync, and transitions to the `PlayerActivity`.

## 7. Background Services & Lifecycle

### 7.1 Background Services Architecture (WorkManager)
* **`HeartbeatWorker`**: Runs periodically (e.g., every 15 mins as a fallback to Realtime Presence) to call `increment_device_playtime` or a dedicated heartbeat endpoint.
* **`SyncWorker`**: Triggered by Realtime broadcasts, FCM (if added later), or periodically to ensure the local DB matches the server state.
* **`DownloadWorker`**: Handles fetching files from signed URLs into local storage.

### 7.2 Kiosk/Signage Runtime Lifecycle & Media Lifecycle
* **App Pinned Mode:** The Activity can request `startLockTask()` to prevent users from exiting the app (requires Device Owner provisioning for true kiosk).
* **Boot Receiver:** A `BroadcastReceiver` listening to `ACTION_BOOT_COMPLETED` will start the `PlayerActivity` automatically on device startup.

### 7.3 Watchdog & Self-Healing Systems (Error Recovery)
* **Crash Recovery:** `DefaultUncaughtExceptionHandler` will log errors and attempt a graceful restart of the `PlayerActivity`.
* **Process Death:** If the OS kills the app, the Boot/Launcher intent will restart it. State is recovered from Room DB.
* **Network Interruptions:** Coroutine flows catch IOExceptions. The app falls back to playing cached assets. Downloads are paused and retried by WorkManager with exponential backoff.
* **Playback Failures:** If ExoPlayer emits a `PlaybackException` (e.g., corrupted file), the `PlaybackManager` logs the error, marks the asset as corrupted (triggering a re-download), and immediately skips to the next item.

## 8. Fleet/Device Management & Scaling

### 8.1 Android TV Optimization Strategy
* Handle DPAD navigation for pairing screens.
* Disable screensavers and sleep modes via `WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON`.
* Leanback library requirements in Manifest.
* Handle variable hardware decoders found in diverse Android TV chipsets (Amlogic, MediaTek). Implement decoder fallback strategies.

### 8.2 Scaling Considerations
* **Telemetry Batching:** `total_playtime_seconds` updates should be batched and sent every X minutes rather than per-item to reduce DB load.
* **Storage Optimization:** Implement strict cache limits. Stream assets if storage is full.

## 8.1 Verification checklist (manual)

1. Pair device from CMS → Android leaves pairing screen → content appears after initial sync.
2. Edit playlist in CMS → Android receives `playlist-broadcast` refresh within seconds.
3. Assign a different playlist on the screen → `device-pair` postgres change triggers sync without restart.
4. Force-stop and reopen app → periodic `SyncWorker` and initial realtime sync restore content.
5. Dashboard Screens page → device shows **online** while running; **last seen** updates after force-stop.
6. Toggle airplane mode briefly → reconnect or periodic sync restores playback.

Logcat tags: `PlayerRealtimeManager`, `RealtimeSyncTrigger`, `DownloadWorker`.

## 9. Security Architecture & Hardening

* **Secure Storage:** `EncryptedSharedPreferences` (Jetpack Security) for the `secret` token.
* **Network Security:** Network Security Configuration enforcing HTTPS. Certificate Pinning can be considered.
* **Local Media:** Files stored in Internal Storage (`Context.filesDir`) which is sandboxed and inaccessible to other apps.
* **No Exposed Secrets:** The app relies solely on `hardware_id` and `secret` for RPC calls. No Supabase Service Role keys are shipped.

## 10. Implementation Plan & Migration

### Phase 1: Foundation & Scaffold
* Set up Gradle multi-module project.
* Configure Hilt, Room, Retrofit/Supabase-kt, and Coroutines.
* Implement `EncryptedSharedPreferences` for secret storage.

### Phase 2: Domain & Data Layers
* Map Supabase RPCs to Retrofit interfaces.
* Implement Room entities and DAOs.
* Build the `SyncRepository` and `DownloadWorker`.

### Phase 3: Pairing & Authentication
* Build the Device Pairing UI.
* Implement the code generation and polling/realtime wait logic.

### Phase 4: Media Engine (The Core)
* Integrate Media3 ExoPlayer.
* Build `PlaybackManager` and the double-buffering transition logic.
* Implement robust Image rendering.

### Phase 5: Realtime & Watchdog
* Integrate Supabase Realtime for broadcasts.
* Implement Boot Receiver, Keep-Screen-On, and Crash Handlers.
* Optimize for 4K and Android TV profiles.

### Phase 6: Testing & Rollout
* Stress test with 4K assets on low-end hardware.
* Network throttle testing for offline-first resilience.
* Migrate existing web-player users by distributing the APK.

## 11. Risks & Bottlenecks
1. **Hardware Fragmentation:** Android TV boxes vary wildly in codec support. **Mitigation:** Rely on ExoPlayer's software fallback if hardware decoding fails, and profile extensively.
2. **Thermal Throttling:** Continuous 4K playback can overheat fanless devices. **Mitigation:** Efficient memory use, `SurfaceView`, and allowing devices to sleep the screen based on schedule (future feature).
3. **Storage Exhaustion:** **Mitigation:** Aggressive cache eviction and accurate size calculation prior to download.

---
*End of Document*
