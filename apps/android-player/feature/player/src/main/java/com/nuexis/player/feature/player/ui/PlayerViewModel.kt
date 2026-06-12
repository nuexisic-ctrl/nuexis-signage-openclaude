package com.nuexis.player.feature.player.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuexis.player.core.database.dao.AssetDao
import com.nuexis.player.core.domain.model.PlaylistItem
import com.nuexis.player.core.domain.realtime.PlayerRealtimeSession
import com.nuexis.player.core.domain.repository.PlaylistRepository
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.domain.repository.AssetRepository
import com.nuexis.player.core.domain.sync.AssetSyncDiagnosticsManager
import com.nuexis.player.core.media.PlaybackManager
import com.nuexis.player.core.network.realtime.PlayerRealtimeManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import com.nuexis.player.core.domain.sync.SyncWorkScheduler
import com.nuexis.player.feature.player.BuildConfig
import javax.inject.Inject

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val playbackManager: PlaybackManager,
    private val playlistRepository: PlaylistRepository,
    private val deviceRepository: DeviceRepository,
    private val playerRealtimeManager: PlayerRealtimeManager,
    private val assetDao: AssetDao,
    private val assetRepository: AssetRepository,
    private val diagnosticsManager: AssetSyncDiagnosticsManager,
    private val syncWorkScheduler: SyncWorkScheduler
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlayerUiState>(PlayerUiState.Loading)
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var playlistItems: List<PlaylistItem> = emptyList()
    private var currentIndex = 0
    private var activePlaylistId: String? = null
    private var skipCount = 0
    private var playingItemId: String? = null


    val deviceStateFlow = deviceRepository.observeLocalDeviceState()

    // Mute state — delegates to PlaybackManager
    val isMuted: StateFlow<Boolean> = playbackManager.isMuted

    // Error log for sidebar debug view
    private val _errorLog = MutableStateFlow<List<String>>(emptyList())
    val errorLog: StateFlow<List<String>> = _errorLog.asStateFlow()

    val diagnostics = diagnosticsManager.diagnostics

    init {
        observeDeviceAndStartRealtime()
        observePlaylist()
    }

    fun refreshContent() {
        viewModelScope.launch {
            try {
                val device = deviceRepository.observeLocalDeviceState().firstOrNull() ?: return@launch
                val playlistId = device.playlistId
                val assetId = device.assetId
                if (device.contentType == "Playlist" && playlistId != null) {
                    playlistRepository.syncPlaylist(playlistId)
                    syncWorkScheduler.enqueueDownload()
                } else if (device.contentType == "Asset" && assetId != null) {
                    deviceRepository.syncSingleAsset(assetId)
                    syncWorkScheduler.enqueueDownload()
                }
            } catch (e: Exception) {
                logError("Refresh failed: ${e.message}")
            }
        }
    }

    fun toggleMute() {
        playbackManager.setMuted(!isMuted.value)
    }

    fun unpairDevice() {
        viewModelScope.launch {
            try {
                val device = deviceRepository.observeLocalDeviceState().firstOrNull()
                    ?: throw Exception("No device state found")
                val hardwareId = deviceRepository.getHardwareId()
                val secret = deviceRepository.getSecret()
                    ?: throw Exception("No device secret found")

                playerRealtimeManager.stop()
                deviceRepository.unpairDevice(device.id, hardwareId, secret)
                // MainActivity will observe device state change and show pairing screen
            } catch (e: Exception) {
                logError("Unpair failed: ${e.message}")
            }
        }
    }

    fun updateOrientation(orientation: Int) {
        if (orientation !in listOf(0, 90, 180, 270)) return
        viewModelScope.launch {
            try {
                val device = deviceRepository.observeLocalDeviceState().firstOrNull()
                    ?: throw Exception("No device state found")
                val hardwareId = deviceRepository.getHardwareId()
                val secret = deviceRepository.getSecret()
                    ?: throw Exception("No device secret found")

                deviceRepository.updateOrientation(device.id, hardwareId, secret, orientation)
            } catch (e: Exception) {
                logError("Orientation update failed: ${e.message}")
            }
        }
    }

    private fun logError(message: String) {
        Log.e(TAG, message)
        val timestamp = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
            .format(java.util.Date())
        _errorLog.value = (_errorLog.value + "[$timestamp] $message").takeLast(MAX_ERROR_LOG_SIZE)
        // Only set error state if not currently playing AND not in a multi-item playlist
        if (playlistItems.size <= 1) {
            val current = _uiState.value
            if (current !is PlayerUiState.PlayingVideo &&
                current !is PlayerUiState.PlayingImage &&
                current !is PlayerUiState.PlayingWebsite
            ) {
                _uiState.value = PlayerUiState.Error(message)
            }
        }
    }

    private fun observeDeviceAndStartRealtime() {
        viewModelScope.launch {
            deviceRepository.observeLocalDeviceState()
                .filterNotNull()
                .distinctUntilChanged { old, new ->
                    old.teamId == new.teamId &&
                        old.playlistId == new.playlistId &&
                        old.id == new.id
                }
                .collect { device ->
                    val teamId = device.teamId
                    if (teamId == null) {
                        _uiState.value = PlayerUiState.NoContent
                        return@collect
                    }

                    val session = PlayerRealtimeSession(
                        deviceId = device.id,
                        teamId = teamId,
                        playlistId = device.playlistId
                    )
                    playerRealtimeManager.updateSession(session)

                    if (device.playlistId == null && device.contentType != "Asset") {
                        _uiState.value = PlayerUiState.NoContent
                    }
                }
        }
    }

    private fun observePlaylist() {
        viewModelScope.launch {
            deviceRepository.observeLocalDeviceState()
                .filterNotNull()
                .distinctUntilChanged { old, new ->
                    old.contentType == new.contentType &&
                    (old.playlistId ?: old.assetId) == (new.playlistId ?: new.assetId)
                }
                .collectLatest { device ->
                    val contentType = device.contentType
                    val contentId = device.playlistId ?: device.assetId
                    if (contentType == null || contentId == null) {
                        _uiState.value = PlayerUiState.NoContent
                        return@collectLatest
                    }

                    // Trigger sync immediately whenever content ID/type changes or on startup
                    refreshContent()

                    if (contentType == "Playlist") {
                        activePlaylistId = contentId
                        playlistRepository.observeLocalPlaylist(contentId).collect { playlist ->
                            if (playlist != null && playlist.items.isNotEmpty()) {
                                playlistItems = playlist.items
                                playCurrentItem()
                            } else {
                                // If we have a playlist assigned but no items in DB, we might be syncing
                                if (playlistItems.isEmpty()) {
                                    _uiState.value = PlayerUiState.Loading
                                } else {
                                    _uiState.value = PlayerUiState.NoContent
                                }
                            }
                        }
                    } else if (contentType == "Asset") {
                        activePlaylistId = null
                        assetDao.observeAsset(contentId).collect { asset ->
                            if (asset != null) {
                                if (asset.downloadStatus == com.nuexis.player.core.domain.model.DownloadStatus.COMPLETED) {
                                    val domainAsset = com.nuexis.player.core.domain.model.Asset(
                                        id = asset.id,
                                        filePath = asset.filePath,
                                        mimeType = asset.mimeType,
                                        sizeBytes = asset.sizeBytes,
                                        localFileUri = asset.localFileUri,
                                        downloadStatus = asset.downloadStatus
                                    )
                                    val type = when {
                                        asset.mimeType.startsWith("video/") -> "video"
                                        asset.mimeType.startsWith("image/") -> "image"
                                        asset.mimeType.startsWith("application/x-widget") -> "widget"
                                        else -> "image"
                                    }
                                    val widgetType = if (type == "widget") {
                                        when (asset.mimeType) {
                                            "application/x-widget-website", "application/x-widget-remote-url" -> "website"
                                            "application/x-widget-flow", "application/x-widget-countdown", "application/x-widget-worldclock", "application/x-widget-countup", "application/x-widget-html" -> "website"
                                            else -> "unsupported"
                                        }
                                    } else null

                                    val widgetConfig = if (widgetType == "website") {
                                        if (asset.mimeType == "application/x-widget-website" || asset.mimeType == "application/x-widget-remote-url") {
                                            "{\"url\":\"${asset.filePath}\"}"
                                        } else {
                                            val secretParam = device.secret ?: ""
                                            val hwId = deviceRepository.getHardwareId()
                                            val widgetUrl = "${BuildConfig.PLAYER_URL}/widget/${asset.id}?hardwareId=${hwId}&secret=${secretParam}"
                                            "{\"url\":\"${widgetUrl}\"}"
                                        }
                                    } else null

                                    val singleItem = PlaylistItem(
                                        id = "single_asset_item",
                                        playlistId = null,
                                        type = type,
                                        assetId = asset.id,
                                        widgetType = widgetType,
                                        widgetConfig = widgetConfig,
                                        durationSeconds = 3600, // Show for an hour or until update
                                        sortOrder = 0,
                                        asset = domainAsset
                                    )
                                    playlistItems = listOf(singleItem)
                                    currentIndex = 0
                                    playCurrentItem()
                                } else if (asset.downloadStatus == com.nuexis.player.core.domain.model.DownloadStatus.FAILED) {
                                    logError("Asset download failed: ${asset.filePath}")
                                } else {
                                    _uiState.value = PlayerUiState.Loading
                                }
                            } else {
                                _uiState.value = PlayerUiState.Loading
                            }
                        }
                    } else {
                        _uiState.value = PlayerUiState.NoContent
                    }
                }
        }
    }

    fun playCurrentItem() {
        if (playlistItems.isEmpty()) {
            _uiState.value = PlayerUiState.NoContent
            return
        }

        if (skipCount >= playlistItems.size) {
            // We have skipped all items in the playlist, meaning none of them are playable
            _uiState.value = PlayerUiState.Error("No playable items found in playlist")
            skipCount = 0
            return
        }

        val item = playlistItems[currentIndex]
        
        // Guard: do not restart if already playing this item
        if (playingItemId == item.id && (
            _uiState.value is PlayerUiState.PlayingVideo ||
            _uiState.value is PlayerUiState.PlayingImage ||
            _uiState.value is PlayerUiState.PlayingWebsite
        )) {
            return
        }
        playingItemId = item.id

        val asset = item.asset
        
        // Handle native media (video/image) which requires a local file
        if ((item.type == "video" || item.type == "image")) {
            val localUri = asset?.localFileUri
            if (localUri != null && asset.downloadStatus == com.nuexis.player.core.domain.model.DownloadStatus.COMPLETED) {
                skipCount = 0 // Reset skip count on successful play
                try {
                    if (item.type == "video") {
                        playbackManager.preloadNext(localUri)
                        playbackManager.swapAndPlay()
                        _uiState.value = PlayerUiState.PlayingVideo(playbackManager)
                    } else {
                        _uiState.value = PlayerUiState.PlayingImage(localUri, item.durationSeconds)
                    }
                } catch (e: Exception) {
                    logError("Playback error (${item.type}): ${e.message}")
                    skipCount++
                    advanceToNext()
                }
            } else {
                // Asset not ready, show loading and wait for observation to trigger replay
                _uiState.value = PlayerUiState.Loading
                // If this is part of a playlist, try skipping to next
                if (playlistItems.size > 1) {
                    viewModelScope.launch {
                        delay(2000)
                        // If it started playing in the meantime, do not skip
                        if (playingItemId == item.id && (
                            _uiState.value is PlayerUiState.PlayingVideo ||
                            _uiState.value is PlayerUiState.PlayingImage ||
                            _uiState.value is PlayerUiState.PlayingWebsite
                        )) {
                            return@launch
                        }
                        skipCount++
                        advanceToNext()
                    }
                }
            }
        } else if (item.type == "widget") {
            val isNativeWebsite = item.widgetType == "website" || item.widgetType == "webpage" || item.widgetType == "remote-url"
            
            viewModelScope.launch {
                try {
                    val url = if (isNativeWebsite) {
                        extractUrlFromConfig(item.widgetConfig)
                    } else if (item.widgetType == "flow" || item.widgetType == "countdown" || item.widgetType == "worldclock" || item.widgetType == "countup" || item.widgetType == "html") {
                        // Fetch device state once to construct widget URL with auth query parameters
                        val device = deviceRepository.observeLocalDeviceState().firstOrNull()
                        val secretParam = device?.secret ?: ""
                        val hwId = deviceRepository.getHardwareId()
                        val assetId = item.assetId
                        if (assetId != null) {
                            "${BuildConfig.PLAYER_URL}/widget/${assetId}?hardwareId=${hwId}&secret=${secretParam}"
                        } else null
                    } else null

                    if (url != null) {
                        skipCount = 0 // Reset skip count on successful play
                        _uiState.value = PlayerUiState.PlayingWebsite(url, item.durationSeconds)
                    } else {
                        logError("Widget URL could not be resolved (type=${item.widgetType})")
                        skipCount++
                        advanceToNext()
                    }
                } catch (e: Exception) {
                    logError("Widget error: ${e.message}")
                    skipCount++
                    advanceToNext()
                }
            }
        } else {
            logError("Unsupported content type: ${item.type}")
            skipCount++
            advanceToNext()
        }
    }

    private fun extractUrlFromConfig(config: String?): String? {
        if (config == null) return null
        // Simple extraction for now, assuming JSON-like structure {"url":"..."}
        // In a real app, use a JSON library
        val regex = "\"url\"\\s*:\\s*\"([^\"]+)\"".toRegex()
        return regex.find(config)?.groupValues?.get(1)
    }

    fun advanceToNext() {
        if (playlistItems.isEmpty()) return
        playingItemId = null
        currentIndex = (currentIndex + 1) % playlistItems.size
        playCurrentItem()
    }

    fun retryPlayback() {
        viewModelScope.launch {
            try {
                playingItemId = null
                _uiState.value = PlayerUiState.Loading
                assetRepository.resetFailedDownloads()
                syncWorkScheduler.enqueueDownload()
                playCurrentItem()
            } catch (e: Exception) {
                logError("Retry failed: ${e.message}")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        playbackManager.release()
    }

    companion object {
        private const val TAG = "PlayerViewModel"
        private const val MAX_ERROR_LOG_SIZE = 50
    }
}

sealed class PlayerUiState {
    object Loading : PlayerUiState()
    object NoContent : PlayerUiState()
    data class Error(val message: String) : PlayerUiState()
    data class PlayingVideo(val playbackManager: PlaybackManager) : PlayerUiState()
    data class PlayingImage(val uri: String, val durationSeconds: Int) : PlayerUiState()
    data class PlayingWebsite(val url: String, val durationSeconds: Int) : PlayerUiState()
}
