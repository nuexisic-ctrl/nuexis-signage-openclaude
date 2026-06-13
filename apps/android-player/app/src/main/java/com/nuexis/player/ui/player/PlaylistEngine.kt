package com.nuexis.player.ui.player

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import com.nuexis.player.data.local.CachedPlaylistItem
import kotlinx.coroutines.delay

@Composable
fun PlaylistEngine(
    playlist: List<CachedPlaylistItem>,
    scaleMode: String,
    isMuted: Boolean,
    loopEnabled: Boolean,
    shuffleEnabled: Boolean,
    onActiveItemChanged: (CachedPlaylistItem) -> Unit,
    onPlaybackError: (String) -> Unit = {}
) {
    if (playlist.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF07111F)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Playlist is empty",
                color = Color.White,
                fontSize = 18.sp
            )
        }
        return
    }

    // Play order configuration
    val playOrder = remember(playlist, shuffleEnabled) {
        val indices = playlist.indices.toList()
        if (shuffleEnabled) indices.shuffled() else indices
    }

    // Slot index pointers
    var evenIndex by remember(playlist) { mutableStateOf(0) }
    var oddIndex by remember(playlist) { mutableStateOf(if (playlist.size > 1) 1 else 0) }
    
    // Active Slot: 0 means Even is active, 1 means Odd is active
    var activeSlot by remember(playlist) { mutableStateOf(0) }
    
    // Loading states for both slots
    var evenLoaded by remember { mutableStateOf(false) }
    var oddLoaded by remember { mutableStateOf(false) }
    
    // Transitioning state
    var isTransitioning by remember { mutableStateOf(false) }

    // Resolve active indices
    val activeIndexInOrder = if (activeSlot == 0) evenIndex else oddIndex

    // Safety checks
    val safeActiveIndex = activeIndexInOrder.coerceIn(0, playOrder.lastIndex)
    val activeItem = playlist[playOrder[safeActiveIndex]]
    
    val hasNext = activeIndexInOrder < playOrder.lastIndex || loopEnabled
    val currentItemLoaded = if (activeSlot == 0) evenLoaded else oddLoaded

    // Notify parent of active item (for analytics / heartbeat)
    LaunchedEffect(activeItem.id) {
        onActiveItemChanged(activeItem)
    }

    // Handle duration timeout loop for active slot
    LaunchedEffect(activeItem.id, currentItemLoaded, hasNext) {
        if (currentItemLoaded && hasNext) {
            val durationSeconds = activeItem.durationSeconds.coerceAtLeast(3)
            delay(durationSeconds * 1000L - 350L) // Wait until transition start
            
            // Start crossfade transition
            isTransitioning = true
            delay(350L) // Wait for crossfade to complete
            
            // Swap active slot
            if (activeSlot == 0) {
                // Odd becomes active. We load next index into Even in background.
                activeSlot = 1
                evenIndex = (oddIndex + 1) % playOrder.size
                evenLoaded = false
            } else {
                // Even becomes active. We load next index into Odd in background.
                activeSlot = 0
                oddIndex = (evenIndex + 1) % playOrder.size
                oddLoaded = false
            }
            isTransitioning = false
        }
    }

    // Safety timeout for loading active item (5 seconds max)
    LaunchedEffect(activeItem.id) {
        delay(5000L)
        if (activeSlot == 0) {
            if (!evenLoaded) evenLoaded = true
        } else {
            if (!oddLoaded) oddLoaded = true
        }
    }

    // Crossfade animation values
    val transitionDuration = 350
    val evenAlpha by animateFloatAsState(
        targetValue = if (activeSlot == 0) (if (isTransitioning) 0f else 1f) else (if (isTransitioning) 1f else 0f),
        animationSpec = tween(durationMillis = transitionDuration),
        label = "EvenAlpha"
    )
    val oddAlpha by animateFloatAsState(
        targetValue = if (activeSlot == 1) (if (isTransitioning) 0f else 1f) else (if (isTransitioning) 1f else 0f),
        animationSpec = tween(durationMillis = transitionDuration),
        label = "OddAlpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // Render Even Slot
        val evenItem = playlist[playOrder[evenIndex.coerceIn(0, playOrder.lastIndex)]]
        Box(
            modifier = Modifier
                .fillMaxSize()
                .alpha(evenAlpha)
        ) {
            key("even_${evenItem.id}") {
                PlayableItem(
                    item = evenItem,
                    scaleMode = scaleMode,
                    isMuted = isMuted,
                    isActive = activeSlot == 0 || isTransitioning,
                    onMediaLoaded = {
                        evenLoaded = true
                    },
                    onMediaError = onPlaybackError
                )
            }
        }

        // Render Odd Slot (only if playlist size > 1)
        if (playlist.size > 1) {
            val oddItem = playlist[playOrder[oddIndex.coerceIn(0, playOrder.lastIndex)]]
            Box(
                modifier = Modifier
                    .fillMaxSize()
                .alpha(oddAlpha)
        ) {
            key("odd_${oddItem.id}") {
                PlayableItem(
                    item = oddItem,
                    scaleMode = scaleMode,
                    isMuted = isMuted,
                    isActive = activeSlot == 1 || isTransitioning,
                    onMediaLoaded = {
                        oddLoaded = true
                    },
                    onMediaError = onPlaybackError
                )
            }
        }
    }
}
}
