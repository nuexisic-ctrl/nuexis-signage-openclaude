package com.nuexis.player.feature.player.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuexis.player.core.database.dao.AssetDao
import com.nuexis.player.core.domain.model.PlaylistItem
import com.nuexis.player.core.domain.realtime.PlayerRealtimeSession
import com.nuexis.player.core.domain.repository.PlaylistRepository
import com.nuexis.player.core.domain.repository.DeviceRepository
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
    private val syncWorkScheduler: SyncWorkScheduler
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlayerUiState>(PlayerUiState.Loading)
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var playlistItems: List<PlaylistItem> = emptyList()
    private var currentIndex = 0
    private var activePlaylistId: String? = null
    private var skipCount = 0

    val deviceStateFlow = deviceRepository.observeLocalDeviceState()

    init {
        observeDeviceAndStartRealtime()
        observePlaylist()
    }

    fun refreshContent() {
        viewModelScope.launch {
            val device = deviceRepository.observeLocalDeviceState().firstOrNull() ?: return@launch
            if (device.contentType == "Playlist" && device.playlistId != null) {
                playlistRepository.syncPlaylist(device.playlistId)
                syncWorkScheduler.enqueueDownload()
            } else if (device.contentType == "Asset" && device.assetId != null) {
                deviceRepository.syncSingleAsset(device.assetId)
                syncWorkScheduler.enqueueDownload()
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
                                    // Trigger a manual sync if we've been stuck for a while
                                    refreshContent()
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
                                            val widgetUrl = "${BuildConfig.PLAYER_URL}/widget/${asset.id}?hardwareId=${device.id}&secret=${secretParam}"
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
                                } else {
                                    _uiState.value = PlayerUiState.Loading
                                }
                            } else {
                                _uiState.value = PlayerUiState.Loading
                                refreshContent()
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
            _uiState.value = PlayerUiState.NoContent
            skipCount = 0
            return
        }

        val item = playlistItems[currentIndex]
        val asset = item.asset
        
        // Handle native media (video/image) which requires a local file
        if ((item.type == "video" || item.type == "image")) {
            val localUri = asset?.localFileUri
            if (localUri != null && asset.downloadStatus == com.nuexis.player.core.domain.model.DownloadStatus.COMPLETED) {
                skipCount = 0 // Reset skip count on successful play
                if (item.type == "video") {
                    playbackManager.preloadNext(localUri)
                    playbackManager.swapAndPlay()
                    _uiState.value = PlayerUiState.PlayingVideo(playbackManager)
                } else {
                    _uiState.value = PlayerUiState.PlayingImage(localUri, item.durationSeconds)
                }
            } else {
                // Asset not ready, show loading and wait for observation to trigger replay
                _uiState.value = PlayerUiState.Loading
                // If this is part of a playlist, try skipping to next
                if (playlistItems.size > 1) {
                    viewModelScope.launch {
                        delay(2000)
                        skipCount++
                        advanceToNext()
                    }
                }
            }
        } else if (item.type == "widget") {
            val isNativeWebsite = item.widgetType == "website" || item.widgetType == "webpage" || item.widgetType == "remote-url"
            
            viewModelScope.launch {
                val url = if (isNativeWebsite) {
                    extractUrlFromConfig(item.widgetConfig)
                } else if (item.widgetType == "flow" || item.widgetType == "countdown" || item.widgetType == "worldclock" || item.widgetType == "countup" || item.widgetType == "html") {
                    // Fetch device state once to construct widget URL with auth query parameters
                    val device = deviceRepository.observeLocalDeviceState().firstOrNull()
                    val secretParam = device?.secret ?: ""
                    val hwId = device?.id ?: ""
                    val assetId = item.assetId
                    if (assetId != null) {
                        "${BuildConfig.PLAYER_URL}/widget/${assetId}?hardwareId=${hwId}&secret=${secretParam}"
                    } else null
                } else null

                if (url != null) {
                    skipCount = 0 // Reset skip count on successful play
                    _uiState.value = PlayerUiState.PlayingWebsite(url, item.durationSeconds)
                } else {
                    skipCount++
                    advanceToNext()
                }
            }
        } else {
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
        currentIndex = (currentIndex + 1) % playlistItems.size
        playCurrentItem()
    }

    override fun onCleared() {
        super.onCleared()
        playbackManager.release()
    }
}

sealed class PlayerUiState {
    object Loading : PlayerUiState()
    object NoContent : PlayerUiState()
    data class PlayingVideo(val playbackManager: PlaybackManager) : PlayerUiState()
    data class PlayingImage(val uri: String, val durationSeconds: Int) : PlayerUiState()
    data class PlayingWebsite(val url: String, val durationSeconds: Int) : PlayerUiState()
}
