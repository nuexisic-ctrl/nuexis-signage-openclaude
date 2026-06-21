package com.nuexis.player

import android.content.Context
import android.util.Log
import android.widget.FrameLayout
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import com.nuexis.player.playback.CacheManager
import com.nuexis.player.playback.MediaEngine
import kotlinx.coroutines.*
import com.google.gson.Gson
import com.nuexis.player.playback.PlaylistEngine
import java.io.IOException
import com.nuexis.player.cache.CacheStore
import com.nuexis.player.cache.DownloadQueue
import com.nuexis.player.cache.StartupValidator
import com.nuexis.player.sync.ManifestCoordinator
import com.nuexis.player.sync.SyncTrigger

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

    var manifestCoordinator: ManifestCoordinator? = null
        private set

    private val gson = Gson()
    private val cacheStore = CacheStore(context)
    private val downloadQueue = DownloadQueue(context, cacheStore) { filePath ->
        val hardwareId = storageManager.getHardwareId()
        val secret = storageManager.getSecret() ?: ""
        try {
            supabaseClient.getSignedMediaUrl(filePath, hardwareId, secret)
        } catch (e: Exception) {
            filePath
        }
    }
    private val startupValidator = StartupValidator(context, cacheStore, storageManager, downloadQueue)



    var lastName: String? = null
        private set
    var lastTeamId: String? = null
        private set
    var lastContentType: String? = null
        private set
    var lastAssetId: String? = null
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
    // Set whenever initMediaEngine() rebuilds the playback graph so the next
    // syncSignageContent() cannot short-circuit via the "no change" fast path.
    private var mediaEngineRebuilt = false

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
            // Ping immediately on tracking start to reflect online status instantly
            val initialDeviceId = storageManager.getDeviceId()
            val initialSessionToken = storageManager.getSessionToken()
            if (initialDeviceId != null && initialSessionToken != null) {
                withContext(Dispatchers.IO) {
                    try {
                        supabaseClient.pingDevice(initialDeviceId, initialSessionToken)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

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
        playlistEngine?.release()
        manifestCoordinator?.release()
        val engine = MediaEngine(context, viewport, storageManager, supabaseClient).apply {
            setMuted(storageManager.isMuted())
        }
        mediaEngine = engine
        playlistEngine = PlaylistEngine(context, engine, cacheManager, storageManager)
        manifestCoordinator = ManifestCoordinator(
            context = context,
            supabaseClient = supabaseClient,
            storageManager = storageManager,
            cacheStore = cacheStore,
            downloadQueue = downloadQueue,
            playlistEngine = playlistEngine!!,
            onDeviceUnpaired = { listener.onDeviceUnpaired() },
            onOrientationChanged = { orientation: Int ->
                listener.applyNativeOrientation(orientation)
                listener.updateOrientationButtonText()
            },
            onManifestPromoted = { manifest: SupabaseClient.PlayerManifest ->
                lastName = manifest.device_id
                lastTeamId = manifest.team_id
                lastContentType = manifest.content_type
                lastOrientation = manifest.orientation
                lastAssetId = manifest.assignment?.asset_id
                lastScaleMode = storageManager.getScaleMode()
                lastUpdatedAt = null
                isContentLoaded = true
            }
        )
        mediaEngineRebuilt = true
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
        downloadQueue.stop()
        manifestCoordinator?.release()
        manifestCoordinator = null
        playlistEngine?.release()
        playlistEngine = null
        mediaEngine?.release()
        mediaEngine = null
    }

    fun syncSignageContent(forceReload: Boolean = false, preFetchedState: SupabaseClient.DeviceState? = null) {
        val trigger = if (preFetchedState != null) SyncTrigger.REALTIME else SyncTrigger.MANUAL
        manifestCoordinator?.sync(trigger)
    }

    fun startOfflinePlaybackFromCache() {
        val cachedType = storageManager.getCachedContentType()
        Log.d("ContentSyncManager", "Starting offline playback from cache. Type: $cachedType")
        
        listener.onPreparePlayerUI()

        val viewport = listener.getViewport()
        if (viewport != null) {
            initMediaEngine(viewport)
        }

        scope.launch {
            startupValidator.validateAtStartup()
            withContext(Dispatchers.Main) {
                if (cachedType == "Asset" || cachedType == "Playlist") {
                    manifestCoordinator?.loadLocalLiveManifest()
                }
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
        lastName = null
        lastTeamId = null
        lastContentType = null
        lastAssetId = null
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

