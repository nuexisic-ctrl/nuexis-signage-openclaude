package com.nuexis.player.playback

import android.content.Context
import android.util.Log
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import com.nuexis.player.data.SupabaseClient.PlayerManifest
import com.nuexis.player.data.SupabaseClient.ManifestPlaylistItem
import kotlinx.coroutines.*
import java.io.File

class PlaylistEngine(
    private val context: Context,
    private val mediaEngine: MediaEngine,
    private val cacheManager: CacheManager,
    private val storageManager: StorageManager
) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var playbackJob: Job? = null

    var currentManifest: PlayerManifest? = null
        private set
    private var currentIndex = 0
    var isPlaying = false
        private set


    fun start(manifest: PlayerManifest) {
        stop()
        currentManifest = manifest
        currentIndex = 0
        isPlaying = true

        val items = manifest.playlist
        if (items.isEmpty()) {
            Log.w("PlaylistEngine", "Playlist is empty, stopping playback views")
            mediaEngine.stopAll()
            return
        }

        playCurrentItem()
    }

    fun stop() {
        isPlaying = false
        playbackJob?.cancel()
        playbackJob = null
    }

    private fun playCurrentItem() {
        if (!isPlaying) return
        val manifest = currentManifest ?: return
        val items = manifest.playlist
        if (items.isEmpty()) return

        // Bound check index
        if (currentIndex < 0 || currentIndex >= items.size) {
            currentIndex = 0
        }

        val item = items[currentIndex]
        Log.d("PlaylistEngine", "Playing item index $currentIndex: ${item.type}, assetId: ${item.asset_id}")

        // Play the item in the active viewport
        val playedSuccessfully = playItemInViewport(item, isPreload = false)

        if (!playedSuccessfully) {
            Log.e("PlaylistEngine", "Failed to play item ${item.id}, skipping to next")
            scope.launch {
                delay(1000) // Small delay before skipping to avoid infinite rapid loops
                advanceToNext()
            }
            return
        }

        // If there's only one item, don't schedule transitions or preloads
        if (items.size <= 1) {
            Log.d("PlaylistEngine", "Single item playlist, loop handled by player or static display")
            return
        }

        // Preload the next item
        val nextIndex = (currentIndex + 1) % items.size
        val nextItem = items[nextIndex]
        preloadItem(nextItem)

        // Schedule transition
        val durationMs = (item.duration_seconds.coerceAtLeast(1) * 1000L)
        playbackJob?.cancel()
        playbackJob = scope.launch {
            delay(durationMs)
            Log.d("PlaylistEngine", "Duration expired for item index $currentIndex, transitioning")
            transitionToNextItem()
        }
    }

    private fun transitionToNextItem() {
        if (!isPlaying) return
        val manifest = currentManifest ?: return
        val items = manifest.playlist
        if (items.isEmpty()) return

        val transitionMs = manifest.transition_ms.toLong().coerceAtLeast(0L)

        mediaEngine.transitionToNext(transitionMs) {
            // Callback when transition animation completes
            currentIndex = (currentIndex + 1) % items.size
            
            // If loop is disabled and we completed the cycle, stop
            if (!manifest.loop_enabled && currentIndex == 0) {
                Log.d("PlaylistEngine", "Playlist loop is disabled, completed sequence. Stopping.")
                stop()
                return@transitionToNext
            }

            playCurrentItem()
        }
    }

    private fun advanceToNext() {
        val manifest = currentManifest ?: return
        val items = manifest.playlist
        if (items.isEmpty()) return

        currentIndex = (currentIndex + 1) % items.size
        playCurrentItem()
    }

    private fun playItemInViewport(item: ManifestPlaylistItem, isPreload: Boolean): Boolean {
        try {
            val scaleMode = storageManager.getScaleMode()
            val isMuted = storageManager.isMuted()

            when (item.type.lowercase()) {
                "image" -> {
                    val asset = item.asset ?: return false
                    val file = cacheManager.getCachedFile(asset.file_path)
                    if (!file.exists() || file.length() == 0L) {
                        Log.e("PlaylistEngine", "Image asset file not found in cache: ${asset.file_path}")
                        return false
                    }
                    if (isPreload) {
                        mediaEngine.preloadImage(file, scaleMode)
                    } else {
                        mediaEngine.playImage(file, scaleMode)
                    }
                }
                "video" -> {
                    val asset = item.asset ?: return false
                    val file = cacheManager.getCachedFile(asset.file_path)
                    if (!file.exists() || file.length() == 0L) {
                        Log.e("PlaylistEngine", "Video asset file not found in cache: ${asset.file_path}")
                        return false
                    }
                    if (isPreload) {
                        mediaEngine.preloadVideo(file, scaleMode, isMuted)
                    } else {
                        mediaEngine.playVideo(file, scaleMode, isMuted)
                    }
                }
                "widget" -> {
                    val mimeType = item.asset?.mime_type ?: item.widget_type ?: "application/x-widget-website"
                    val configJson = item.widget_config?.toString() ?: ""
                    if (isPreload) {
                        mediaEngine.preloadWidget(mimeType, configJson)
                    } else {
                        mediaEngine.playWidget(mimeType, configJson)
                    }
                }
                else -> {
                    Log.e("PlaylistEngine", "Unknown playlist item type: ${item.type}")
                    return false
                }
            }
            return true
        } catch (e: Exception) {
            Log.e("PlaylistEngine", "Error playing item in viewport (isPreload=$isPreload)", e)
            return false
        }
    }

    private fun preloadItem(item: ManifestPlaylistItem) {
        Log.d("PlaylistEngine", "Preloading next item: ${item.type}, assetId: ${item.asset_id}")
        playItemInViewport(item, isPreload = true)
    }

    fun release() {
        stop()
        scope.cancel()
    }
}
