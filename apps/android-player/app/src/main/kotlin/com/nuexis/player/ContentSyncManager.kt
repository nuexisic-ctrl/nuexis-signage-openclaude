package com.nuexis.player

import android.content.Context
import android.util.Log
import android.widget.FrameLayout
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import com.nuexis.player.playback.CacheManager
import com.nuexis.player.playback.MediaEngine
import com.nuexis.player.playback.PlaylistEngine
import kotlinx.coroutines.*

class ContentSyncManager(
    private val context: Context,
    private val supabaseClient: SupabaseClient,
    private val storageManager: StorageManager,
    private val cacheManager: CacheManager,
    private val scope: CoroutineScope,
    private val listener: ContentSyncListener
) {
    var mediaEngine: MediaEngine? = null
        private set
    var playlistEngine: PlaylistEngine? = null
        private set

    var lastTeamId: String? = null
        private set
    var lastContentType: String? = null
        private set
    var lastAssetId: String? = null
        private set
    var lastPlaylistId: String? = null
        private set
    var lastOrientation: Int? = null
        private set
    var lastScaleMode: String? = null
        private set
    var lastUpdatedAt: String? = null
        private set
    var isContentLoaded = false
        private set

    private var onlineCheckJob: Job? = null
    var currentScaleMode = "Fit"
    private var statusTrackingJob: Job? = null
    private var accumulatedPlaytimeSeconds = 0

    fun getAppVersion(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    fun getOsVersion(): String {
        return "Android ${android.os.Build.VERSION.RELEASE}"
    }

    fun startStatusTracking(deviceId: String) {
        statusTrackingJob?.cancel()
        statusTrackingJob = scope.launch {
            while (true) {
                delay(60000)
                accumulatedPlaytimeSeconds += 60
                if (accumulatedPlaytimeSeconds >= 900) {
                    flushPlaytime(async = true)
                }
                val currentDeviceId = storageManager.getDeviceId()
                val sessionToken = storageManager.getSessionToken()
                if (currentDeviceId != null && sessionToken != null) {
                    withContext(Dispatchers.IO) {
                        try {
                            supabaseClient.pingDevice(currentDeviceId, sessionToken)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            }
        }
    }

    fun stopStatusTracking() {
        statusTrackingJob?.cancel()
        statusTrackingJob = null
    }

    fun flushPlaytime(async: Boolean = true) {
        val secondsToFlush = accumulatedPlaytimeSeconds
        if (secondsToFlush > 0) {
            accumulatedPlaytimeSeconds = 0
            val deviceId = storageManager.getDeviceId()
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret()
            if (deviceId != null && secret != null) {
                if (async) {
                    @OptIn(kotlinx.coroutines.DelicateCoroutinesApi::class)
                    GlobalScope.launch(Dispatchers.IO) {
                        try {
                            supabaseClient.incrementPlaytime(deviceId, hardwareId, secret, secondsToFlush)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                } else {
                    try {
                        supabaseClient.incrementPlaytime(deviceId, hardwareId, secret, secondsToFlush)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
    }

    fun initMediaEngine(viewport: FrameLayout) {
        mediaEngine?.release()
        mediaEngine = MediaEngine(context, viewport, storageManager, supabaseClient).apply {
            setMuted(storageManager.isMuted())
        }
    }

    fun setMuted(muted: Boolean) {
        mediaEngine?.setMuted(muted)
    }

    fun stopAll() {
        playlistEngine?.stop()
        mediaEngine?.stopAll()
    }

    fun release() {
        onlineCheckJob?.cancel()
        onlineCheckJob = null
        stopStatusTracking()
        playlistEngine?.stop()
        playlistEngine = null
        mediaEngine?.release()
        mediaEngine = null
    }

    fun syncSignageContent(forceReload: Boolean = false, preFetchedState: SupabaseClient.DeviceState? = null) {
        scope.launch(Dispatchers.IO) {
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret() ?: return@launch
            val result = if (preFetchedState != null) {
                SupabaseClient.DeviceStateResult.Success(preFetchedState)
            } else {
                supabaseClient.getDeviceState(hardwareId, secret, getAppVersion(), getOsVersion())
            }

            withContext(Dispatchers.Main) {
                when (result) {
                    is SupabaseClient.DeviceStateResult.Success -> {
                        val state = result.state
                        if (state != null) {
                            val changed = forceReload || !isContentLoaded ||
                                    state.team_id != lastTeamId ||
                                    state.orientation != lastOrientation ||
                                    state.content_type != lastContentType ||
                                    state.asset_id != lastAssetId ||
                                    state.playlist_id != lastPlaylistId ||
                                    state.scale_mode != lastScaleMode ||
                                    state.updated_at != lastUpdatedAt

                            if (!changed) {
                                Log.d("ContentSyncManager", "syncSignageContent: No change detected. Skipping reload.")
                                return@withContext
                            }

                            Log.d("ContentSyncManager", "syncSignageContent: Change detected (forceReload=$forceReload, isContentLoaded=$isContentLoaded). Reloading player configuration.")
                            isContentLoaded = true

                            // Update tracked values
                            lastTeamId = state.team_id
                            lastOrientation = state.orientation
                            lastContentType = state.content_type
                            lastAssetId = state.asset_id
                            lastPlaylistId = state.playlist_id
                            lastScaleMode = state.scale_mode
                            lastUpdatedAt = state.updated_at

                            if (state.orientation != null) {
                                storageManager.setOrientation(state.orientation)
                                listener.applyNativeOrientation(state.orientation)
                                listener.updateOrientationButtonText()
                            }

                            if (state.scale_mode != null) {
                                storageManager.setScaleMode(state.scale_mode)
                                currentScaleMode = state.scale_mode
                            }

                            // Update cached content configuration
                            storageManager.setCachedContentType(state.content_type)

                            if (state.content_type == "Asset" && !state.asset_id.isNullOrEmpty()) {
                                storageManager.setCachedAssetId(state.asset_id)
                                loadAssetContent(state.asset_id, hardwareId, secret)
                            } else if (state.content_type == "Playlist" && !state.playlist_id.isNullOrEmpty()) {
                                storageManager.setCachedPlaylistId(state.playlist_id)
                                loadPlaylistContent(state.playlist_id, hardwareId, secret)
                            } else {
                                playlistEngine?.stop()
                                mediaEngine?.stopAll()
                            }
                        } else {
                            // Device unlinked or secret invalid
                            listener.onDeviceUnpaired()
                        }
                    }
                    is SupabaseClient.DeviceStateResult.Error -> {
                        Log.e("ContentSyncManager", "syncSignageContent failed: ${result.exception.message}", result.exception)
                        listener.showErrorToast("Sync failed: ${result.exception.message}")
                        
                        // Fall back to offline playback if not already playing anything
                        if (mediaEngine == null) {
                            val cachedContentType = storageManager.getCachedContentType()
                            if (cachedContentType != null) {
                                startOfflinePlaybackFromCache()
                            }
                        }
                    }
                }
            }
        }
    }

    private fun loadAssetContent(assetId: String, hardwareId: String, secret: String) {
        playlistEngine?.stop()
        scope.launch(Dispatchers.IO) {
            try {
                val asset = supabaseClient.getPlayerAsset(assetId, hardwareId, secret)
                if (asset != null) {
                    // Update cache paths
                    storageManager.setCachedAssetFilePath(asset.file_path)
                    storageManager.setCachedAssetMimeType(asset.mime_type)

                    // Handle widgets: they store JSON config in file_path, not a storage path
                    if (asset.mime_type.startsWith("application/x-widget")) {
                        withContext(Dispatchers.Main) {
                            mediaEngine?.playWidget(asset.mime_type, asset.file_path)
                        }
                        return@launch
                    }

                    val file = cacheManager.downloadAsset(asset.file_path, hardwareId, secret)
                    withContext(Dispatchers.Main) {
                        if (asset.mime_type.startsWith("video/")) {
                            mediaEngine?.playVideo(file, currentScaleMode, storageManager.isMuted())
                        } else {
                            mediaEngine?.playImage(file, currentScaleMode)
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                withContext(Dispatchers.Main) {
                    listener.showErrorToast("Failed to load asset online: ${e.message}")
                    // Offline fallback: try to load the last cached asset file
                    val cachedPath = storageManager.getCachedAssetFilePath()
                    val cachedMime = storageManager.getCachedAssetMimeType()
                    if (cachedPath != null && cachedMime != null) {
                        if (cachedMime.startsWith("application/x-widget")) {
                            mediaEngine?.playWidget(cachedMime, cachedPath)
                        } else {
                            val file = cacheManager.getCachedFile(cachedPath)
                            if (file.exists() && file.length() > 0) {
                                if (cachedMime.startsWith("video/")) {
                                    mediaEngine?.playVideo(file, currentScaleMode, storageManager.isMuted())
                                } else {
                                    mediaEngine?.playImage(file, currentScaleMode)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fun loadPlaylistContent(playlistId: String, hardwareId: String, secret: String) {
        if (playlistEngine == null) {
            val media = mediaEngine ?: return
            playlistEngine = PlaylistEngine(
                context,
                scope,
                supabaseClient,
                cacheManager,
                media,
                storageManager,
                listener.getDiagnosticsManager()
            )
        }
        playlistEngine?.start(playlistId, hardwareId, secret)
    }

    fun startOfflinePlaybackFromCache() {
        val cachedType = storageManager.getCachedContentType()
        Log.d("ContentSyncManager", "Starting offline playback from cache. Type: $cachedType")
        
        listener.onPreparePlayerUI()

        val viewport = listener.getViewport()
        if (viewport != null) {
            initMediaEngine(viewport)
        }

        if (cachedType == "Asset") {
            val filePath = storageManager.getCachedAssetFilePath()
            val mimeType = storageManager.getCachedAssetMimeType()
            if (filePath != null && mimeType != null) {
                val file = cacheManager.getCachedFile(filePath)
                if (file.exists() && file.length() > 0) {
                    if (mimeType.startsWith("video/")) {
                        mediaEngine?.playVideo(file, currentScaleMode, storageManager.isMuted())
                    } else {
                        mediaEngine?.playImage(file, currentScaleMode)
                    }
                } else {
                    listener.showErrorToast("Cached asset file not found locally.")
                }
            } else {
                listener.showErrorToast("No cached asset configuration found.")
            }
        } else if (cachedType == "Playlist") {
            val cachedManifest = storageManager.getCachedManifest()
            if (!cachedManifest.isNullOrEmpty()) {
                if (playlistEngine == null) {
                    val media = mediaEngine ?: return
                    playlistEngine = PlaylistEngine(
                        context,
                        scope,
                        supabaseClient,
                        cacheManager,
                        media,
                        storageManager,
                        listener.getDiagnosticsManager()
                    )
                }
                playlistEngine?.startOffline(cachedManifest)
            } else {
                listener.showErrorToast("No cached playlist manifest found.")
            }
        }
        
        startOnlineCheckLoop()
    }

    fun startOnlineCheckLoop() {
        onlineCheckJob?.cancel()
        onlineCheckJob = scope.launch(Dispatchers.IO) {
            while (true) {
                delay(30000)
                Log.d("ContentSyncManager", "Checking online status...")
                val hardwareId = storageManager.getHardwareId()
                val secret = storageManager.getSecret()
                val result = supabaseClient.getDeviceState(hardwareId, secret, getAppVersion(), getOsVersion())
                if (result is SupabaseClient.DeviceStateResult.Success && result.state != null) {
                    Log.d("ContentSyncManager", "Device is back online. Reloading online player state.")
                    withContext(Dispatchers.Main) {
                        onlineCheckJob?.cancel()
                        onlineCheckJob = null
                        listener.onOnlineRestored()
                    }
                    break
                }
            }
        }
    }

    fun cancelOnlineCheck() {
        onlineCheckJob?.cancel()
        onlineCheckJob = null
    }

    fun isOnlineChecking(): Boolean {
        return onlineCheckJob != null
    }

    fun clearState() {
        lastTeamId = null
        lastContentType = null
        lastAssetId = null
        lastPlaylistId = null
        lastOrientation = null
        lastScaleMode = null
        lastUpdatedAt = null
        isContentLoaded = false
    }
}

interface ContentSyncListener {
    fun getViewport(): FrameLayout?
    fun getDiagnosticsManager(): com.nuexis.player.diagnostics.DiagnosticsManager?
    fun showErrorToast(msg: String)
    fun applyNativeOrientation(degrees: Int)
    fun updateOrientationButtonText()
    fun onPreparePlayerUI()
    fun onOnlineRestored()
    fun onDeviceUnpaired()
}
