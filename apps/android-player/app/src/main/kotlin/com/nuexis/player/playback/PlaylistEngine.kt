package com.nuexis.player.playback

import android.content.Context
import android.util.Log
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import kotlinx.coroutines.*
import java.io.File

class PlaylistEngine(
    private val context: Context,
    private val coroutineScope: CoroutineScope,
    private val supabaseClient: SupabaseClient,
    private val cacheManager: CacheManager,
    private val mediaEngine: MediaEngine,
    private val storageManager: StorageManager,
    private val diagnosticsManager: com.nuexis.player.diagnostics.DiagnosticsManager? = null
) {
    private val tag = "PlaylistEngine"
    private var playlistId: String? = null
    private var items: List<SupabaseClient.PlaylistItem> = emptyList()
    private var currentIndex = 0
    private var playbackJob: Job? = null
    private var isRunning = false
    var currentItemId: String? = null

    fun start(playlistId: String, hardwareId: String, secret: String) {
        this.playlistId = playlistId
        this.isRunning = true
        Log.d(tag, "Starting PlaylistEngine for playlist $playlistId")
        
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val fetchedItems = supabaseClient.getPlaylistItems(playlistId, hardwareId, secret)
                withContext(Dispatchers.Main) {
                    if (!isRunning) return@withContext
                    updatePlaylist(fetchedItems, hardwareId, secret)
                }
            } catch (e: Exception) {
                Log.e(tag, "Failed to fetch playlist items on start: ${e.message}", e)
            }
        }
    }

    fun updatePlaylist(newItems: List<SupabaseClient.PlaylistItem>, hardwareId: String, secret: String) {
        Log.d(tag, "Updating playlist with ${newItems.size} items")
        stopPlayback()
        
        val previousPlayingId = currentItemId ?: items.getOrNull(currentIndex)?.id
        val sortedNewItems = newItems.sortedBy { it.sort_order }
        this.items = sortedNewItems

        // Cache the updated manifest items
        if (newItems.isNotEmpty()) {
            try {
                val itemsJson = com.google.gson.Gson().toJson(newItems)
                storageManager.setCachedManifest(itemsJson)
            } catch (e: Exception) {
                Log.e(tag, "Failed to cache manifest: ${e.message}")
            }
        }
        
        // Evict stale cache files by collecting all active non-widget file paths
        val activeFilePaths = items.mapNotNull { item ->
            val assets = item.assets
            if (assets != null && !assets.mime_type.startsWith("application/x-widget")) {
                assets.file_path
            } else null
        }.toSet()
        coroutineScope.launch(Dispatchers.IO) {
            cacheManager.evictStaleFiles(activeFilePaths)
        }

        if (items.isEmpty()) {
            mediaEngine.stopAll()
            return
        }

        // Try to maintain index or reset to 0
        if (previousPlayingId != null) {
            val indexInNew = sortedNewItems.indexOfFirst { it.id == previousPlayingId }
            currentIndex = if (indexInNew != -1) {
                indexInNew
            } else {
                0
            }
        } else {
            if (currentIndex >= items.size) {
                currentIndex = 0
            }
        }

        playCurrentIndex(hardwareId, secret)
    }

    private fun playCurrentIndex(hardwareId: String, secret: String) {
        if (items.isEmpty() || !isRunning) return

        val currentItem = items[currentIndex]
        Log.d(tag, "Playing item at index $currentIndex: ID=${currentItem.id}, type=${currentItem.type}")

        // 1. Play active item
        coroutineScope.launch(Dispatchers.Main) {
            try {
                playItem(currentItem, hardwareId, secret, active = true)
                currentItemId = currentItem.id
                
                val cacheStatus = if (currentItem.assets != null) {
                    if (cacheManager.isCached(currentItem.assets.file_path)) "HIT" else "MISS"
                } else null
                
                diagnosticsManager?.reportPlaybackEvent(
                    eventType = "PLAY_START",
                    itemId = currentItem.id,
                    assetId = currentItem.asset_id,
                    cacheStatus = cacheStatus
                )
            } catch (e: Exception) {
                Log.e(tag, "Error playing active item at index $currentIndex: ${e.message}", e)
                diagnosticsManager?.reportPlaybackEvent(
                    eventType = "ERROR",
                    itemId = currentItem.id,
                    assetId = currentItem.asset_id,
                    errorMessage = e.message
                )
            }
        }

        // If there is only 1 item, play it and do not set timers or preload transitions
        if (items.size == 1) {
            Log.d(tag, "Single-item playlist. Playing indefinitely without transition timers.")
            return
        }

        // 2. Preload the next item in the background
        val nextIndex = (currentIndex + 1) % items.size
        val nextItem = items[nextIndex]
        preloadItem(nextItem, hardwareId, secret)

        // 3. Schedule transition to the next item
        playbackJob = coroutineScope.launch(Dispatchers.Main) {
            delay(currentItem.duration_seconds * 1000L)
            
            Log.d(tag, "Item duration completed. Transitioning to index $nextIndex")
            
            diagnosticsManager?.reportPlaybackEvent(
                eventType = "PLAY_COMPLETE",
                itemId = currentItem.id,
                assetId = currentItem.asset_id
            )
            
            mediaEngine.transitionToNext(transitionMs = 350) {
                currentIndex = nextIndex
                playCurrentIndex(hardwareId, secret)
            }
        }
    }

    private suspend fun playItem(
        item: SupabaseClient.PlaylistItem,
        hardwareId: String,
        secret: String,
        active: Boolean
    ) {
        val assets = item.assets
        val scaleMode = storageManager.getScaleMode()
        val isMuted = storageManager.isMuted()

        if (assets == null) {
            // Widget or unsupported item with no asset
            if (active) mediaEngine.stopAll()
            return
        }

        val isWidget = assets.mime_type.startsWith("application/x-widget")

        if (isWidget) {
            // Widget configurations are stored as strings directly in file_path
            val widgetConfig = assets.file_path
            val mimeType = assets.mime_type

            if (active) {
                Log.d(tag, "Active play of widget: $mimeType")
                mediaEngine.playWidget(mimeType, widgetConfig)
            } else {
                Log.d(tag, "Preload widget: $mimeType")
                mediaEngine.preloadWidget(mimeType, widgetConfig)
            }
        } else {
            // Standard media (image/video)
            val file = withContext(Dispatchers.IO) {
                cacheManager.downloadAsset(assets.file_path, hardwareId, secret)
            }

            if (active) {
                if (assets.mime_type.startsWith("video/")) {
                    mediaEngine.playVideo(file, scaleMode, isMuted)
                } else {
                    mediaEngine.playImage(file, scaleMode)
                }
            } else {
                if (assets.mime_type.startsWith("video/")) {
                    mediaEngine.preloadVideo(file, scaleMode, isMuted)
                } else {
                    mediaEngine.preloadImage(file, scaleMode)
                }
            }
        }
    }

    private fun preloadItem(item: SupabaseClient.PlaylistItem, hardwareId: String, secret: String) {
        val assets = item.assets ?: return
        val isWidget = assets.mime_type.startsWith("application/x-widget")

        coroutineScope.launch(Dispatchers.IO) {
            try {
                if (!isWidget) {
                    // Pre-download file to cache
                    cacheManager.downloadAsset(assets.file_path, hardwareId, secret)
                }
                
                withContext(Dispatchers.Main) {
                    if (!isRunning) return@withContext
                    playItem(item, hardwareId, secret, active = false)
                }
            } catch (e: Exception) {
                Log.e(tag, "Failed to preload item: ${e.message}", e)
            }
        }
    }

    private fun stopPlayback() {
        playbackJob?.cancel()
        playbackJob = null
    }

    fun startOffline(itemsJson: String) {
        this.isRunning = true
        Log.d(tag, "Starting PlaylistEngine offline with cached items.")
        try {
            val type = object : com.google.gson.reflect.TypeToken<List<SupabaseClient.PlaylistItem>>() {}.type
            val parsedItems: List<SupabaseClient.PlaylistItem> = com.google.gson.Gson().fromJson(itemsJson, type)
            updatePlaylist(parsedItems, "", "")
        } catch (e: Exception) {
            Log.e(tag, "Failed to parse offline playlist: ${e.message}", e)
        }
    }

    fun stop() {
        isRunning = false
        stopPlayback()
        mediaEngine.stopAll()
        Log.d(tag, "PlaylistEngine stopped.")
    }
}
