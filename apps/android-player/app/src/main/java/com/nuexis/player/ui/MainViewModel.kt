package com.nuexis.player.ui

import android.app.Application
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nuexis.player.data.local.*
import com.nuexis.player.data.model.*
import com.nuexis.player.data.remote.RealtimeClient
import com.nuexis.player.data.remote.SupabaseApi
import com.nuexis.player.service.HeartbeatService
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.*

sealed class UiState {
    object Loading : UiState()
    data class Pairing(val code: String, val remainingMs: Long, val isRegistering: Boolean = false) : UiState()
    data class Paired(val config: DeviceConfig, val playlist: List<CachedPlaylistItem>) : UiState()
    object Expired : UiState()
    data class Error(val message: String) : UiState()
}

class MainViewModel(application: Application, private val database: PlayerDatabase) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "MainViewModel"
        private const val PAIRING_DURATION_MS = 600000L // 10 minutes
    }

    private val api = SupabaseApi()
    private val realtime = RealtimeClient()
    
    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private var countdownJob: Job? = null
    private var pollingJob: Job? = null
    private var pairingHandshakeJob: Job? = null
    private var isSyncing = false
    private var isCompletingPairing = false

    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    init {
        loadOrCreateDeviceConfig()
        registerNetworkCallback()
        observeConnectionState()
    }

    private fun loadOrCreateDeviceConfig() {
        viewModelScope.launch {
            try {
                var config = database.deviceConfigDao().getConfig()
                val hardwareId = getHardwareId(getApplication())

                if (config == null) {
                    config = DeviceConfig(hardwareId = hardwareId)
                    database.deviceConfigDao().saveConfig(config)
                }

                if (config.deviceId != null && config.secret != null && config.teamId != null) {
                    // 1. Immediately load player content from cache to prevent empty/loading state
                    val cachedPlaylist = database.playlistItemDao().getPlaylist()
                    _uiState.value = UiState.Paired(config, cachedPlaylist)
                    Log.d(TAG, "Startup: Immediately loaded cached playlist of size ${cachedPlaylist.size}")

                    // 2. Initialize connections and background synchronization
                    initPairedDevice(config)
                } else {
                    // Device is unpaired, start pairing process
                    startPairingWorkflow(config)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading device config", e)
                _uiState.value = UiState.Error("Database init error: ${e.message}")
            }
        }
    }

    private fun getHardwareId(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        if (androidId.isNotEmpty()) return androidId
        
        // Fallback to fingerprint hash
        val fingerprint = Build.FINGERPRINT
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(fingerprint.toByteArray())
            hash.joinToString("") { "%02x".format(it) }.take(16)
        } catch (e: Exception) {
            "android_fallback_" + System.currentTimeMillis()
        }
    }

    // ── Pairing Mode Workflow ──

    private fun startPairingWorkflow(config: DeviceConfig) {
        viewModelScope.launch {
            val now = System.currentTimeMillis()
            val expiryTime = getExpiryTimeMs(config.expiresAt)
            
            if (config.pairingCode.isNotEmpty() && expiryTime > now) {
                // Reuse existing code
                showPairingScreen(config.pairingCode, expiryTime - now, config)
            } else {
                // Generate a new pairing code
                generateAndRegisterNewCode(config)
            }
        }
    }

    private fun getExpiryTimeMs(isoString: String?): Long {
        if (isoString.isNullOrEmpty()) return 0L
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            sdf.parse(isoString)?.time ?: 0L
        } catch (e: Exception) {
            try {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                sdf.parse(isoString)?.time ?: 0L
            } catch (e2: Exception) {
                0L
            }
        }
    }

    private suspend fun generateAndRegisterNewCode(config: DeviceConfig) {
        isCompletingPairing = false
        _uiState.value = UiState.Pairing("", PAIRING_DURATION_MS, isRegistering = true)
        val code = generateAlphanumericCode()
        val expiresAtMs = System.currentTimeMillis() + PAIRING_DURATION_MS
        val expiresAtIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date(expiresAtMs))
        
        var result: RegistrationResult? = null
        var attempt = 0
        while (kotlin.coroutines.coroutineContext.isActive && result == null) {
            Log.d(TAG, "Registering device pairing code: $code, expiresAt: $expiresAtIso (attempt ${attempt + 1})")
            result = api.registerPlayerDevice(config.hardwareId, code, expiresAtIso)
            if (result == null) {
                attempt++
                val delayMs = Math.min(60000L, 2000L * Math.pow(2.0, (attempt - 1).toDouble()).toLong())
                Log.w(TAG, "Registration failed, retrying in ${delayMs}ms...")
                delay(delayMs)
            }
        }

        if (result != null) {
            val updatedConfig = config.copy(
                deviceId = result.id,
                pairingCode = code,
                expiresAt = result.expiresAt ?: "",
                secret = result.secret,
                status = result.status ?: "pairing",
                teamId = result.teamId
            )
            database.deviceConfigDao().saveConfig(updatedConfig)
            if (updatedConfig.teamId != null) {
                initPairedDevice(updatedConfig)
            } else {
                showPairingScreen(code, PAIRING_DURATION_MS, updatedConfig)
            }
        }
    }

    private fun generateAlphanumericCode(): String {
        val chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789" // Omit easily confused characters like I, 1, O, 0
        val random = Random()
        return (1..6).map { chars[random.nextInt(chars.length)] }.joinToString("")
    }

    private fun showPairingScreen(code: String, durationMs: Long, config: DeviceConfig) {
        // Start countdown timer
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            var timeLeft = durationMs
            while (timeLeft > 0) {
                _uiState.value = UiState.Pairing(code, timeLeft)
                delay(1000L)
                timeLeft -= 1000L
            }
            _uiState.value = UiState.Expired
            // Auto restart workflow on expiry
            delay(3000L)
            generateAndRegisterNewCode(config)
        }

        // Start polling for pairing completion (fallback in case socket realtime fails)
        startStatePolling(config)

        // Listen for Realtime Postgres device update handshake
        startRealtimePairingHandshake(config)
    }

    private fun startStatePolling(config: DeviceConfig) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(15000L) // Poll every 15 seconds during pairing
                Log.d(TAG, "Polling device status for completion...")
                val fresh = api.getDeviceState(config.hardwareId, config.secret)
                if (fresh != null && fresh.teamId != null) {
                    Log.d(TAG, "Pairing detected via polling! TeamId: ${fresh.teamId}")
                    completePairing(config, fresh.id, fresh.teamId)
                    break
                }
            }
        }
    }

    private fun startRealtimePairingHandshake(config: DeviceConfig) {
        realtime.connect(config.deviceId!!, null, null, config.secret, config.sessionToken)
        pairingHandshakeJob?.cancel()
        pairingHandshakeJob = viewModelScope.launch {
            realtime.deviceUpdates.collect { record ->
                val teamId = (record["team_id"] as? JsonPrimitive)?.contentOrNull
                if (!teamId.isNullOrEmpty()) {
                    Log.d(TAG, "Pairing detected via Realtime! TeamId: $teamId")
                    val currentConfig = database.deviceConfigDao().getConfig()
                    if (currentConfig != null) {
                        completePairing(currentConfig, config.deviceId, teamId)
                    }
                }
            }
        }
    }

    private suspend fun completePairing(currentConfig: DeviceConfig, deviceId: String, teamId: String) {
        if (isCompletingPairing) return
        isCompletingPairing = true

        countdownJob?.cancel()
        pollingJob?.cancel()
        pairingHandshakeJob?.cancel()
        
        Log.d(TAG, "Completing pairing workflow...")
        val sessionResult = api.exchangeDeviceSecretForSession(deviceId, currentConfig.hardwareId, currentConfig.secret!!)
        if (sessionResult != null) {
            val pairedConfig = currentConfig.copy(
                deviceId = deviceId,
                teamId = teamId,
                sessionToken = sessionResult.sessionToken,
                status = "online"
            )
            database.deviceConfigDao().saveConfig(pairedConfig)
            initPairedDevice(pairedConfig)
        } else {
            Log.e(TAG, "Failed to exchange secret for session token!")
            isCompletingPairing = false
            _uiState.value = UiState.Error("Authentication handshake failed. Retrying...")
            delay(2000L)
            showPairingScreen(currentConfig.pairingCode, getExpiryTimeMs(currentConfig.expiresAt) - System.currentTimeMillis(), currentConfig)
        }
    }

    // ── Paired Mode Workflow ──

    private suspend fun initPairedDevice(config: DeviceConfig) {
        Log.d(TAG, "Initializing paired device: deviceId=${config.deviceId}, teamId=${config.teamId}")
        
        var activeConfig = config
        if (activeConfig.sessionToken.isNullOrEmpty()) {
            Log.d(TAG, "Session token is missing in initPairedDevice. Fetching a new one...")
            val sessionResult = api.exchangeDeviceSecretForSession(activeConfig.deviceId!!, activeConfig.hardwareId, activeConfig.secret!!)
            if (sessionResult != null) {
                activeConfig = activeConfig.copy(sessionToken = sessionResult.sessionToken)
                database.deviceConfigDao().saveConfig(activeConfig)
            } else {
                Log.e(TAG, "Failed to exchange secret for session token during initialization!")
                _uiState.value = UiState.Error("Authentication failed: session token could not be retrieved.")
                return
            }
        }

        // 1. Start background Heartbeat foreground service
        startHeartbeatService(activeConfig)

        // 2. Connect to Realtime database state channels and Broadcast refresh channel
        realtime.connect(activeConfig.deviceId!!, activeConfig.teamId, activeConfig.playlistId, activeConfig.secret, activeConfig.sessionToken)
        
        // 3. Setup reactive collection on WebSocket channels
        observeRealtimeChannels(activeConfig)

        // 4. Initial Synchronization of content
        synchronizeContent(activeConfig)
    }

    private fun observeRealtimeChannels(config: DeviceConfig) {
        viewModelScope.launch {
            // Observe Postgres device record updates (unpair action, orientation, content assignments)
            realtime.deviceUpdates.collect { record ->
                val isDeleted = (record["is_deleted"] as? JsonPrimitive)?.contentOrNull?.toBoolean() ?: false
                val teamId = (record["team_id"] as? JsonPrimitive)?.contentOrNull
                if (isDeleted || teamId == null) {
                    Log.d(TAG, "Device was deleted or unpaired by CMS!")
                    performUnpair(localOnly = true)
                    return@collect
                }

                // If content configuration changed, sync it
                val orientation = (record["orientation"] as? JsonPrimitive)?.contentOrNull?.toIntOrNull() ?: config.orientation
                val contentType = (record["content_type"] as? JsonPrimitive)?.contentOrNull
                val assetId = (record["asset_id"] as? JsonPrimitive)?.contentOrNull
                val playlistId = (record["playlist_id"] as? JsonPrimitive)?.contentOrNull

                val currentLocalConfig = database.deviceConfigDao().getConfig() ?: config
                val updatedConfig = currentLocalConfig.copy(
                    orientation = orientation,
                    contentType = contentType,
                    assetId = assetId,
                    playlistId = playlistId
                )
                database.deviceConfigDao().saveConfig(updatedConfig)

                // Enforce orientation changes
                if (orientation != currentLocalConfig.orientation) {
                    database.deviceConfigDao().updateOrientation(orientation)
                }

                Log.d(TAG, "CMS device update detected. Triggering sync...")
                synchronizeContent(updatedConfig)
            }
        }

        viewModelScope.launch {
            // Observe playlist broadcast refresh signals (hard-reload playlist)
            realtime.playlistRefreshSignals.collect { playlistId ->
                Log.d(TAG, "Playlist refresh broadcast received for: $playlistId")
                val currentLocalConfig = database.deviceConfigDao().getConfig()
                if (currentLocalConfig != null && currentLocalConfig.playlistId == playlistId) {
                    synchronizeContent(currentLocalConfig, forceHardRefresh = true)
                }
            }
        }
    }

    private fun startHeartbeatService(config: DeviceConfig) {
        val intent = Intent(getApplication(), HeartbeatService::class.java).apply {
            action = HeartbeatService.ACTION_START
            putExtra(HeartbeatService.EXTRA_DEVICE_ID, config.deviceId)
            putExtra(HeartbeatService.EXTRA_HARDWARE_ID, config.hardwareId)
            putExtra(HeartbeatService.EXTRA_SECRET, config.secret)
            putExtra(HeartbeatService.EXTRA_SESSION_TOKEN, config.sessionToken)
            putExtra(HeartbeatService.EXTRA_IS_PLAYING, true)
            putExtra(HeartbeatService.EXTRA_MANIFEST_VERSION, config.currentManifestVersion)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getApplication<Application>().startForegroundService(intent)
        } else {
            getApplication<Application>().startService(intent)
        }
    }

    fun updateServicePlayingStatus(isPlaying: Boolean, currentItemId: String? = null, lastError: String? = null, manifestVersion: String? = null) {
        viewModelScope.launch {
            val config = database.deviceConfigDao().getConfig()
            val intent = Intent(getApplication(), HeartbeatService::class.java).apply {
                action = HeartbeatService.ACTION_UPDATE_STATUS
                putExtra(HeartbeatService.EXTRA_IS_PLAYING, isPlaying)
                putExtra(HeartbeatService.EXTRA_CURRENT_ITEM_ID, currentItemId)
                putExtra(HeartbeatService.EXTRA_LAST_ERROR, lastError)
                putExtra(HeartbeatService.EXTRA_MANIFEST_VERSION, manifestVersion)
                if (config != null) {
                    putExtra(HeartbeatService.EXTRA_SESSION_TOKEN, config.sessionToken)
                }
            }
            getApplication<Application>().startService(intent)
        }
    }

    // ── Synchronization & Media Caching ──

    private fun synchronizeContent(config: DeviceConfig, forceHardRefresh: Boolean = false) {
        if (isSyncing) return
        isSyncing = true
        
        viewModelScope.launch {
            try {
                Log.d(TAG, "Starting content sync cycle: contentType=${config.contentType}, playlistId=${config.playlistId}, assetId=${config.assetId}")
                
                // Fetch fresh device state from database via RPC (resolves group overrides)
                val resolvedState = api.getDeviceState(config.hardwareId, config.secret)
                
                // Check if device was unpaired in CMS (resolvedState is not null, but teamId is null)
                if (resolvedState != null && resolvedState.teamId == null) {
                    Log.d(TAG, "Device was unpaired in CMS (detected during state sync)!")
                    performUnpair(localOnly = true)
                    return@launch
                }

                var activeConfig = if (resolvedState != null) {
                    val updated = config.copy(
                        teamId = resolvedState.teamId,
                        contentType = resolvedState.contentType,
                        assetId = resolvedState.assetId,
                        playlistId = resolvedState.playlistId,
                        orientation = resolvedState.orientation ?: config.orientation
                    )
                    updated
                } else {
                    config
                }

                // Exchange secret for session token if it is missing or empty
                if (activeConfig.sessionToken.isNullOrEmpty()) {
                    Log.d(TAG, "Session token is missing in synchronizeContent. Fetching...")
                    val sessionResult = api.exchangeDeviceSecretForSession(activeConfig.deviceId!!, activeConfig.hardwareId, activeConfig.secret!!)
                    if (sessionResult != null) {
                        activeConfig = activeConfig.copy(sessionToken = sessionResult.sessionToken)
                        // Update WebSocket connection with the new session token
                        realtime.connect(activeConfig.deviceId!!, activeConfig.teamId, activeConfig.playlistId, activeConfig.secret, activeConfig.sessionToken)
                    } else {
                        Log.e(TAG, "Failed to exchange secret for session token during synchronization!")
                        loadCachedLocalContent(activeConfig)
                        return@launch
                    }
                }

                database.deviceConfigDao().saveConfig(activeConfig)

                // Update orientation
                database.deviceConfigDao().updateOrientation(activeConfig.orientation)

                // Check local files validity
                val cachedList = database.playlistItemDao().getPlaylist()
                val cacheValid = cachedList.isNotEmpty() && cachedList.all { item ->
                    val isWidget = item.type == "widget" || item.widgetType != null
                    if (isWidget || item.filePath == null) true
                    else {
                        val localPath = item.localUri
                        localPath != null && File(localPath).exists()
                    }
                }

                // Handle loading based on resolved contentType case-insensitively
                when (activeConfig.contentType?.lowercase(Locale.US)) {
                    "asset" -> {
                        val newManifestVersion = "asset-${activeConfig.assetId}"
                        if (!forceHardRefresh && cacheValid && activeConfig.currentManifestVersion == newManifestVersion) {
                            Log.d(TAG, "Single asset cached and valid. Skipping sync.")
                            _uiState.value = UiState.Paired(activeConfig, cachedList)
                            return@launch
                        }
                        syncSingleAsset(activeConfig)
                    }
                    "playlist" -> {
                        syncPlaylist(activeConfig, forceHardRefresh, cacheValid)
                    }
                    else -> {
                        // Connected but no content assigned
                        database.playlistItemDao().clearPlaylist()
                        _uiState.value = UiState.Paired(activeConfig, emptyList())
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error during synchronization cycle", e)
                // Fallback: load whatever is already in local DB (offline resiliency)
                loadCachedLocalContent(config)
            } finally {
                isSyncing = false
            }
        }
    }

    private suspend fun syncSingleAsset(config: DeviceConfig) {
        val assetId = config.assetId ?: return
        val hardwareId = config.hardwareId
        val secret = config.secret ?: return
        val deviceId = config.deviceId ?: return
        var sessionToken = config.sessionToken ?: return
        var activeConfig = config
        
        Log.d(TAG, "Syncing single asset: $assetId")

        // 1. Fetch asset metadata from API
        val asset = api.getPlayerAsset(hardwareId, secret, assetId)
        if (asset == null) {
            Log.e(TAG, "Failed to resolve single asset details!")
            loadCachedLocalContent(activeConfig)
            return
        }

        val mediaFolder = File(getApplication<Application>().cacheDir, "media")
        mediaFolder.mkdirs()

        var localUri: String? = null
        
        // 2. If it is a physical media file (not a widget), pre-download and cache
        val isWidget = asset.mimeType.startsWith("application/x-widget")
        if (!isWidget && asset.filePath != "folder") {
            val destinationFile = File(mediaFolder, asset.filePath)
            destinationFile.parentFile?.mkdirs()

            // Check if file is already cached
            if (destinationFile.exists() && destinationFile.length() > 0) {
                Log.d(TAG, "Asset already cached locally: ${destinationFile.name}")
                localUri = destinationFile.absolutePath
            } else {
                // Fetch signed url
                var signedUrl = api.getSignedMediaUrl(deviceId, sessionToken, asset.filePath)
                if (signedUrl == null) {
                    Log.e(TAG, "Failed to get signed media URL. Retrying with refreshed session token...")
                    val newSession = api.exchangeDeviceSecretForSession(deviceId, hardwareId, secret)
                    if (newSession != null) {
                        sessionToken = newSession.sessionToken
                        activeConfig = activeConfig.copy(sessionToken = sessionToken)
                        database.deviceConfigDao().saveConfig(activeConfig)
                        realtime.connect(deviceId, activeConfig.teamId, activeConfig.playlistId, secret, sessionToken)
                        signedUrl = api.getSignedMediaUrl(deviceId, sessionToken, asset.filePath)
                    }
                }
                
                if (signedUrl != null) {
                    val downloaded = api.downloadFile(signedUrl, destinationFile)
                    if (downloaded) {
                        localUri = destinationFile.absolutePath
                    }
                }
            }
        } else {
            // Widget: configurations are stored in the file_path text column
            localUri = asset.filePath
        }

        // 3. Save single item in Local DB as a one-item playlist
        val playlistItem = CachedPlaylistItem(
            id = assetId,
            type = if (asset.mimeType.startsWith("video/")) "video" else if (isWidget) "widget" else "image",
            assetId = assetId,
            durationSeconds = 15,
            sortOrder = 0,
            fileName = asset.filePath,
            filePath = asset.filePath,
            localUri = localUri,
            mimeType = asset.mimeType,
            widgetType = if (isWidget) asset.mimeType else null,
            widgetConfig = if (isWidget) asset.filePath else null
        )

        database.playlistItemDao().clearPlaylist()
        database.playlistItemDao().insertItems(listOf(playlistItem))
        database.deviceConfigDao().updateManifestVersion("asset-$assetId")

        val freshConfig = database.deviceConfigDao().getConfig() ?: activeConfig
        _uiState.value = UiState.Paired(freshConfig, listOf(playlistItem))

        // Update realtime websocket subscription to listen for broadcast signals (none for single asset)
        realtime.updatePlaylistSubscription(null)

        // Delete obsolete cache files
        pruneObsoleteCacheFiles(listOf(playlistItem))
    }

    private suspend fun syncPlaylist(config: DeviceConfig, forceHardRefresh: Boolean, cacheValid: Boolean) {
        val playlistId = config.playlistId ?: return
        val deviceId = config.deviceId ?: return
        var sessionToken = config.sessionToken ?: return
        var activeConfig = config

        Log.d(TAG, "Syncing playlist: $playlistId")

        // 1. Fetch playlist manifest items from DB RPC
        var manifestResponse = api.getPlayerManifest(deviceId, sessionToken)
        if (manifestResponse == null) {
            Log.e(TAG, "Failed to fetch player manifest. Retrying with refreshed session token...")
            val newSession = api.exchangeDeviceSecretForSession(deviceId, activeConfig.hardwareId, activeConfig.secret!!)
            if (newSession != null) {
                sessionToken = newSession.sessionToken
                activeConfig = activeConfig.copy(sessionToken = sessionToken)
                database.deviceConfigDao().saveConfig(activeConfig)
                realtime.connect(deviceId, activeConfig.teamId, activeConfig.playlistId, activeConfig.secret, sessionToken)
                manifestResponse = api.getPlayerManifest(deviceId, sessionToken)
            }
        }

        if (manifestResponse == null) {
            Log.w(TAG, "Manifest fetch failed and token refresh did not resolve it. Falling back to cached content.")
            loadCachedLocalContent(activeConfig)
            return
        }
        
        val newManifestVersion = manifestResponse.manifestVersion
        if (!forceHardRefresh && cacheValid && activeConfig.currentManifestVersion == newManifestVersion) {
            Log.d(TAG, "Playlist manifest matches ($newManifestVersion) and cache is valid. Skipping sync.")
            val cachedList = database.playlistItemDao().getPlaylist()
            _uiState.value = UiState.Paired(activeConfig, cachedList)
            return
        }

        val items = manifestResponse.playlist
        if (items.isEmpty()) {
            Log.w(TAG, "Resolved playlist contains 0 items.")
            database.playlistItemDao().clearPlaylist()
            _uiState.value = UiState.Paired(activeConfig, emptyList())
            return
        }

        // 2. Pre-download and cache all media files in the playlist
        val mediaFolder = File(getApplication<Application>().cacheDir, "media")
        mediaFolder.mkdirs()

        val cachedItems = mutableListOf<CachedPlaylistItem>()
        
        for (item in items) {
            var localUri: String? = null
            val isWidget = item.type == "widget" || item.widgetType != null
            val asset = item.asset
            
            if (asset != null && !isWidget && asset.filePath != "folder") {
                val destinationFile = File(mediaFolder, asset.filePath)
                destinationFile.parentFile?.mkdirs()

                // Check cache
                if (destinationFile.exists() && destinationFile.length() > 0) {
                    localUri = destinationFile.absolutePath
                } else {
                    // Fetch signed url and download
                    var signedUrl = api.getSignedMediaUrl(deviceId, sessionToken, asset.filePath)
                    if (signedUrl == null) {
                        Log.e(TAG, "Failed to get signed media URL. Retrying with refreshed session token...")
                        val newSession = api.exchangeDeviceSecretForSession(deviceId, activeConfig.hardwareId, activeConfig.secret!!)
                        if (newSession != null) {
                            sessionToken = newSession.sessionToken
                            activeConfig = activeConfig.copy(sessionToken = sessionToken)
                            database.deviceConfigDao().saveConfig(activeConfig)
                            realtime.connect(deviceId, activeConfig.teamId, activeConfig.playlistId, activeConfig.secret, sessionToken)
                            signedUrl = api.getSignedMediaUrl(deviceId, sessionToken, asset.filePath)
                        }
                    }
                    if (signedUrl != null) {
                        val downloaded = api.downloadFile(signedUrl, destinationFile)
                        if (downloaded) {
                            localUri = destinationFile.absolutePath
                        }
                    }
                }
            } else if (isWidget) {
                // Widget config is stored in widgetConfig
                localUri = item.widgetConfig
            }

            cachedItems.add(
                CachedPlaylistItem(
                    id = item.id,
                    type = item.type,
                    assetId = item.assetId,
                    durationSeconds = item.durationSeconds,
                    sortOrder = item.sortOrder,
                    fileName = asset?.fileName ?: asset?.filePath,
                    filePath = asset?.filePath,
                    localUri = localUri,
                    mimeType = asset?.mimeType ?: item.widgetType,
                    widgetType = item.widgetType,
                    widgetConfig = item.widgetConfig
                )
            )
        }

        // 3. Write to Room Database
        database.playlistItemDao().clearPlaylist()
        database.playlistItemDao().insertItems(cachedItems)

        val newVersion = "manifest-${System.currentTimeMillis()}"
        database.deviceConfigDao().updateManifestVersion(newVersion)

        val freshConfig = database.deviceConfigDao().getConfig() ?: activeConfig
        _uiState.value = UiState.Paired(freshConfig, cachedItems)

        // Update realtime websocket playlist channel subscription
        realtime.updatePlaylistSubscription(playlistId)

        // Prune unused media files
        pruneObsoleteCacheFiles(cachedItems)
    }

    private suspend fun loadCachedLocalContent(config: DeviceConfig) {
        Log.d(TAG, "Sync failed. Loading offline cached content from DB...")
        val cachedList = database.playlistItemDao().getPlaylist()
        _uiState.value = UiState.Paired(config, cachedList)
    }

    private fun pruneObsoleteCacheFiles(activeItems: List<CachedPlaylistItem>) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val mediaFolder = File(getApplication<Application>().cacheDir, "media")
                if (!mediaFolder.exists()) return@launch

                val activeFilePaths = activeItems.mapNotNull { it.filePath }.toSet()
                
                // Traverse media folder recursively and delete files not present in active list
                mediaFolder.walkTopDown().forEach { file ->
                    if (file.isFile) {
                        // Relativize path to teamId/filepath format
                        val relativePath = file.absolutePath.substringAfter(mediaFolder.absolutePath + File.separator)
                        // Windows uses backslashes in paths, normalize to forward slashes to match DB file_path
                        val normalizedPath = relativePath.replace(File.separator, "/")
                        
                        // We extract the sub-path starting after teamId (e.g. team_id/filepath)
                        // If the normalized path is not in the active paths set, delete it!
                        // Ensure we do not delete system hidden files
                        if (!normalizedPath.endsWith(".nomedia") && activeFilePaths.none { normalizedPath.endsWith(it) }) {
                            Log.d(TAG, "Pruning obsolete cache file: $normalizedPath")
                            file.delete()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error pruning cache files", e)
            }
        }
    }

    // ── Interface settings ──

    fun setMute(muted: Boolean) {
        viewModelScope.launch {
            database.deviceConfigDao().updateMute(muted)
            val config = database.deviceConfigDao().getConfig()
            if (config != null && _uiState.value is UiState.Paired) {
                _uiState.value = UiState.Paired(config, (_uiState.value as UiState.Paired).playlist)
            }
        }
    }

    fun setOrientation(orientation: Int) {
        viewModelScope.launch {
            database.deviceConfigDao().updateOrientation(orientation)
            val config = database.deviceConfigDao().getConfig()
            if (config != null) {
                // If paired, push orientation to Supabase backend immediately
                if (config.deviceId != null && config.secret != null) {
                    try {
                        api.updatePlayerDeviceOrientation(config.deviceId, config.hardwareId, config.secret, orientation)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to update orientation on backend", e)
                    }
                }
                if (_uiState.value is UiState.Paired) {
                    _uiState.value = UiState.Paired(config, (_uiState.value as UiState.Paired).playlist)
                }
            }
        }
    }

    fun setLoop(loopEnabled: Boolean) {
        viewModelScope.launch {
            database.deviceConfigDao().updateLoop(loopEnabled)
            val config = database.deviceConfigDao().getConfig()
            if (config != null && _uiState.value is UiState.Paired) {
                _uiState.value = UiState.Paired(config, (_uiState.value as UiState.Paired).playlist)
            }
        }
    }

    fun setShuffle(shuffleEnabled: Boolean) {
        viewModelScope.launch {
            database.deviceConfigDao().updateShuffle(shuffleEnabled)
            val config = database.deviceConfigDao().getConfig()
            if (config != null && _uiState.value is UiState.Paired) {
                _uiState.value = UiState.Paired(config, (_uiState.value as UiState.Paired).playlist)
            }
        }
    }

    fun triggerRefresh() {
        viewModelScope.launch {
            val config = database.deviceConfigDao().getConfig()
            if (config != null) {
                synchronizeContent(config, forceHardRefresh = true)
            }
        }
    }

    fun performUnpair(localOnly: Boolean = false) {
        viewModelScope.launch {
            isCompletingPairing = false
            val config = database.deviceConfigDao().getConfig()
            if (config != null) {
                Log.d(TAG, "Unpairing device: deviceId=${config.deviceId}")
                
                // 1. Stop background service
                val serviceIntent = Intent(getApplication(), HeartbeatService::class.java)
                getApplication<Application>().stopService(serviceIntent)

                // 2. Unsubscribe websocket
                realtime.disconnect()

                // 3. RPC Call to unpair if online
                if (!localOnly && config.deviceId != null && config.secret != null) {
                    try {
                        api.unpairDevice(config.deviceId, config.hardwareId, config.secret)
                    } catch (e: Exception) {
                        Log.e(TAG, "RPC unpair call failed", e)
                    }
                }

                // 4. Clear local database tables
                database.playlistItemDao().clearPlaylist()
                
                // Clear media cache files
                val mediaFolder = File(getApplication<Application>().cacheDir, "media")
                mediaFolder.deleteRecursively()

                // Reset config to unpaired state
                val clearedConfig = DeviceConfig(
                    hardwareId = config.hardwareId,
                    status = "pairing"
                )
                database.deviceConfigDao().saveConfig(clearedConfig)

                // Start pairing workflow anew
                startPairingWorkflow(clearedConfig)
            }
        }
    }

    private fun observeConnectionState() {
        viewModelScope.launch {
            realtime.connectionState.collect { isConnected ->
                Log.d(TAG, "Realtime connection state changed: isConnected=$isConnected")
                if (isConnected) {
                    val currentConfig = database.deviceConfigDao().getConfig()
                    if (currentConfig != null && currentConfig.deviceId != null) {
                        Log.d(TAG, "Reconnection detected! Syncing player state...")
                        synchronizeContent(currentConfig, forceHardRefresh = false)
                    }
                }
            }
        }
    }

    private fun registerNetworkCallback() {
        try {
            val connectivityManager = getApplication<Application>().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val request = android.net.NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
                
            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) {
                    Log.d(TAG, "Network became available (connected to Internet)")
                    viewModelScope.launch {
                        val config = database.deviceConfigDao().getConfig()
                        if (config != null && config.deviceId != null && !realtime.isConnected) {
                            Log.d(TAG, "Network restored. Reconnecting WebSocket...")
                            realtime.connect(config.deviceId, config.teamId, config.playlistId, config.secret, config.sessionToken)
                        }
                    }
                }

                override fun onLost(network: android.net.Network) {
                    Log.d(TAG, "Network connection lost")
                }
            }
            connectivityManager.registerNetworkCallback(request, callback)
            networkCallback = callback
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register network callback", e)
        }
    }

    private fun unregisterNetworkCallback() {
        try {
            networkCallback?.let {
                val connectivityManager = getApplication<Application>().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                connectivityManager.unregisterNetworkCallback(it)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister network callback", e)
        }
    }

    override fun onCleared() {
        unregisterNetworkCallback()
        realtime.destroy()
        super.onCleared()
    }
}
