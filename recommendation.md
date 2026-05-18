# System Audit: Scalability, Performance, and Logging Patterns

This document outlines an audit of the database, authentication, background jobs, realtime events, and logging patterns across the application. The focus is on identifying excessive polling, redundant operations, and noisy logging that could create scalability bottlenecks, drive up storage/bandwidth costs, and negatively impact database performance at scale.

## 1. Excessive Player Polling & Database Reads
**Location:** `app/player/page.tsx` (`startStatePolling` interval)
**Pattern:** The digital signage player implements a 5-second `setInterval` that calls `getDeviceState` via server actions.
**Why it's problematic:** At scale (e.g., 10,000 devices), this generates 120,000 requests to the backend and database per minute. This will rapidly exhaust Supabase connection pooling limits, spike DB CPU usage, and cause widespread latency degradation. 
**Estimated Impact:** Massive Database Load, High API Gateway Bandwidth.
**Recommendations:**
- **Remove Aggressive Polling:** Rely primarily on Supabase Realtime (which is already configured) to push state changes (e.g., `postgres_changes` on the `devices` table or custom broadcast channels) down to the player.
- **Fallback with Jitter & Backoff:** If polling is strictly necessary as a fallback for WebSocket disconnects, increase the interval to 5–15 minutes and implement **exponential backoff** with random **jitter** so all devices don't hit the database at the exact same millisecond.
- **Edge Caching/ETags:** Cache the device state at the CDN/Edge layer so repeated identical polls do not hit the PostgreSQL database.

## 2. Redundant Realtime Presence Tracking & Database Writes
**Location:** `app/player/page.tsx` (60-second `playtimeInterval`)
**Pattern:** Every 60 seconds, each player actively calls `teamChannelRef.current.track(...)`, `incrementPlaytime(...)`, and `sendHeartbeat(...)`.
**Why it's problematic:**
- **Presence:** Supabase Realtime manages presence automatically. Forcing a `.track()` call every 60 seconds forces the Realtime engine to broadcast a sync event to *every connected client* on that channel. This causes an explosion of unnecessary WebSocket messages and CPU load on dashboards.
- **Playtime Updates:** Writing playtime to the database via an RPC every 60 seconds per device causes extreme PostgreSQL row contention and WAL (Write-Ahead Log) bloat. 10,000 devices = 10,000 DB writes per minute.
**Estimated Impact:** High Realtime Quota Usage, High Database Write I/O, High Network Bandwidth.
**Recommendations:**
- **Remove Redundant Tracking:** Remove the recurring `.track()` call from the interval. Only call it once upon channel connection/reconnection.
- **Batch Playtime Writes:** Aggregate playtime locally in browser memory. Flush it to the database at larger intervals (e.g., 15 minutes), or use `navigator.sendBeacon` to reliably submit the total accrued time when the tab unloads or loses visibility.
- **Consolidate Heartbeats:** Since you are using Realtime Presence, evaluate whether the Redis `sendHeartbeat` is actually necessary. Realtime already serves as a source of truth for online/offline status.

## 3. Frontend-Driven Presence Database Syncing
**Location:** `app/customer/[team_slug]/screens/ScreensClient.tsx` (Presence sync listener)
**Pattern:** When a device leaves the realtime presence channel, the frontend dashboard client triggers a database write (`updateDeviceLastSeen`) to mark the device offline.
**Why it's problematic:** 
- Network flapping (e.g., cellular digital signage) will cause devices to constantly drop and rejoin presence.
- If multiple admins have the dashboard open, *all* of them will attempt to write the offline status to the database simultaneously when a device disconnects.
- This creates race conditions and unnecessary write amplification from the client side.
**Estimated Impact:** Redundant Database Writes, Potential Race Conditions.
**Recommendations:**
- **Server-Side Presence Hooks:** Move the responsibility of updating `last_seen_at` to the backend. Use Supabase Webhooks connected to Realtime presence events, or run a lightweight scheduled cron/edge function that cross-references Redis heartbeats to lazily update the Postgres `last_seen_at` field in bulk.

## 4. Aggressive Asset Pre-caching in Playlists
**Location:** `app/player/PlaylistEngine.tsx` (`cacheAssets` function)
**Pattern:** When a playlist loads, the system loops through all items and aggressively pre-fetches/caches them sequentially via `fetch`.
**Why it's problematic:** If a playlist contains a large number of heavy assets (e.g., 50 4K videos), the browser will attempt to download all of them immediately. This blocks the network thread, starves the current playing asset of bandwidth, and can lead to browser Out-Of-Memory (OOM) crashes on low-end signage hardware.
**Estimated Impact:** Severe Bandwidth Spikes, Client Memory Exhaustion, Degraded Playback.
**Recommendations:**
- **Sliding Window Preloading:** Implement a "lookahead" window. Only pre-cache the next 2-3 items in the playlist rather than the entire list upfront.
- **Throttling/Debouncing:** Introduce a delay between fetch requests or use a background web worker so the main UI thread remains smooth.

## 5. Potential Logging Noise and Memory Leaks
**Location:** `app/player/page.tsx` & `app/player/actions.ts`
**Pattern:** Broad use of `console.error` inside loops (`startStatePolling` interval, playtime tracking).
**Why it's problematic:** Digital signage players often run 24/7 for months without a refresh. If an intermittent network error occurs (e.g., DNS failure), the loops will throw an error into the console every 5 seconds. Over weeks, this unbounded console logging can consume significant memory and crash the browser tab.
**Estimated Impact:** Client-side Memory Leaks, Log Bloat.
**Recommendations:**
- **Throttled Logging:** Implement a wrapper around `console.error` that throttles repetitive identical error strings (e.g., max 1 log per minute for the same error).
- **Graceful Degradation:** Stop or exponentially back off the intervals if sequential errors cross a threshold.

## Summary of Architecture Wins
By moving state updates away from constant frontend polling, relying purely on the automatic nature of WebSockets, and batching heavy database writes (like playtime), the application's architecture will comfortably handle 10x-100x its current device load while minimizing Supabase computing and bandwidth costs.