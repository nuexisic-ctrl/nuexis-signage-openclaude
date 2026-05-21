package com.nuexis.player.core.media

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var exoPlayer1: ExoPlayer? = null
    private var exoPlayer2: ExoPlayer? = null
    
    private var activePlayerIndex = 1

    private val _playbackState = MutableStateFlow<PlaybackState>(PlaybackState.Idle)
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    fun getActivePlayer(): ExoPlayer {
        return if (activePlayerIndex == 1) {
            if (exoPlayer1 == null) exoPlayer1 = buildPlayer()
            exoPlayer1!!
        } else {
            if (exoPlayer2 == null) exoPlayer2 = buildPlayer()
            exoPlayer2!!
        }
    }

    fun getBackgroundPlayer(): ExoPlayer {
        return if (activePlayerIndex == 1) {
            if (exoPlayer2 == null) exoPlayer2 = buildPlayer()
            exoPlayer2!!
        } else {
            if (exoPlayer1 == null) exoPlayer1 = buildPlayer()
            exoPlayer1!!
        }
    }

    private fun buildPlayer(): ExoPlayer {
        return ExoPlayer.Builder(context)
            .build().apply {
                repeatMode = Player.REPEAT_MODE_OFF
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == Player.STATE_ENDED) {
                            _playbackState.value = PlaybackState.ItemCompleted
                        }
                    }
                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        _playbackState.value = PlaybackState.Error(error.message ?: "Unknown error")
                    }
                })
            }
    }

    fun preloadNext(uri: String) {
        val bgPlayer = getBackgroundPlayer()
        bgPlayer.setMediaItem(MediaItem.fromUri(uri))
        bgPlayer.prepare()
    }

    fun swapAndPlay() {
        activePlayerIndex = if (activePlayerIndex == 1) 2 else 1
        val player = getActivePlayer()
        player.playWhenReady = true
        _playbackState.value = PlaybackState.Playing
    }
    
    fun release() {
        exoPlayer1?.release()
        exoPlayer2?.release()
        exoPlayer1 = null
        exoPlayer2 = null
    }

    sealed class PlaybackState {
        object Idle : PlaybackState()
        object Playing : PlaybackState()
        object ItemCompleted : PlaybackState()
        data class Error(val message: String) : PlaybackState()
    }
}
