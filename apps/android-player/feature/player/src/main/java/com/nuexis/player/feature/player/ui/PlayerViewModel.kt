package com.nuexis.player.feature.player.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val playbackManager: PlaybackManager,
    private val playlistRepository: PlaylistRepository,
    private val deviceRepository: DeviceRepository,
    private val playerRealtimeManager: PlayerRealtimeManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlayerUiState>(PlayerUiState.Loading)
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var playlistItems: List<PlaylistItem> = emptyList()
    private var currentIndex = 0
    private var activePlaylistId: String? = null

    init {
        observeDeviceAndStartRealtime()
        observePlaylist()
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

                    if (device.playlistId == null) {
                        _uiState.value = PlayerUiState.NoContent
                    }
                }
        }
    }

    private fun observePlaylist() {
        viewModelScope.launch {
            deviceRepository.observeLocalDeviceState()
                .filterNotNull()
                .map { it.playlistId }
                .distinctUntilChanged()
                .collectLatest { playlistId ->
                    if (playlistId == null) {
                        _uiState.value = PlayerUiState.NoContent
                        return@collectLatest
                    }
                    activePlaylistId = playlistId

                    playlistRepository.observeLocalPlaylist(playlistId).collect { playlist ->
                        if (playlist != null && playlist.items.isNotEmpty()) {
                            playlistItems = playlist.items
                            if (_uiState.value is PlayerUiState.Loading ||
                                _uiState.value is PlayerUiState.NoContent
                            ) {
                                playCurrentItem()
                            }
                        } else {
                            _uiState.value = PlayerUiState.NoContent
                        }
                    }
                }
        }
    }

    fun playCurrentItem() {
        if (playlistItems.isEmpty()) return

        val item = playlistItems[currentIndex]
        val localUri = item.asset?.localFileUri

        if (localUri != null) {
            if (item.type == "video") {
                playbackManager.preloadNext(localUri)
                playbackManager.swapAndPlay()
                _uiState.value = PlayerUiState.PlayingVideo(playbackManager)
            } else if (item.type == "image") {
                _uiState.value = PlayerUiState.PlayingImage(localUri, item.durationSeconds)
            }
        } else {
            advanceToNext()
        }
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
}
