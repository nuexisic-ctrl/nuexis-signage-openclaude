package com.nuexis.player.ui.player

import android.content.pm.ActivityInfo
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nuexis.player.MainActivity
import com.nuexis.player.data.local.CachedPlaylistItem
import com.nuexis.player.data.local.DeviceConfig
import com.nuexis.player.ui.MainViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun LivePlayerScreen(
    config: DeviceConfig,
    playlist: List<CachedPlaylistItem>,
    viewModel: MainViewModel,
    isFullscreen: Boolean,
    onFullscreenToggle: (Boolean) -> Unit,
    isSidebarOpen: Boolean,
    onSidebarToggle: (Boolean) -> Unit
) {
    var isOverlayVisible by remember { mutableStateOf(false) }
    var activeItem by remember { mutableStateOf<CachedPlaylistItem?>(null) }
    var lastPlaybackError by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()
    var overlayHideJob by remember { mutableStateOf<Job?>(null) }

    val context = LocalContext.current
    val activity = remember(context) { context as? MainActivity }

    fun toggleOverlay() {
        if (isOverlayVisible) {
            isOverlayVisible = false
            overlayHideJob?.cancel()
        } else {
            isOverlayVisible = true
            overlayHideJob?.cancel()
            overlayHideJob = scope.launch {
                delay(3000L) // Hide controls after 3 seconds
                isOverlayVisible = false
            }
        }
    }

    // Register Activity single-tap callback to toggle overlay visibility
    DisposableEffect(activity) {
        activity?.onSingleTapCallback = {
            toggleOverlay()
        }
        onDispose {
            activity?.onSingleTapCallback = null
        }
    }

    // Material 3 Drawer State
    val drawerState = rememberDrawerState(
        initialValue = if (isSidebarOpen) DrawerValue.Open else DrawerValue.Closed
    )

    // Sync activity sidebar state to Compose drawer state
    LaunchedEffect(isSidebarOpen) {
        if (isSidebarOpen && drawerState.isClosed) {
            drawerState.open()
        } else if (!isSidebarOpen && drawerState.isOpen) {
            drawerState.close()
        }
    }

    // Sync Compose drawer state back to activity sidebar state
    LaunchedEffect(drawerState.currentValue) {
        val isOpen = drawerState.currentValue == DrawerValue.Open
        if (isOpen != isSidebarOpen) {
            onSidebarToggle(isOpen)
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color(0xFF0F172A),
                drawerShape = RoundedCornerShape(topEnd = 0.dp, bottomEnd = 0.dp),
                modifier = Modifier.width(320.dp)
            ) {
                Sidebar(
                    config = config,
                    onClose = { onSidebarToggle(false) },
                    onRefresh = { viewModel.triggerRefresh() },
                    onMuteToggle = { muted -> viewModel.setMute(muted) },
                    onOrientationChange = { orientation -> viewModel.setOrientation(orientation) },
                    onLoopToggle = { loop -> viewModel.setLoop(loop) },
                    onShuffleToggle = { shuffle -> viewModel.setShuffle(shuffle) },
                    onUnpair = { viewModel.performUnpair() }
                )
            }
        },
        gesturesEnabled = drawerState.isOpen // Only allow swipe-to-close when drawer is already open
    ) {
        // Main Screen Area (Unconsumed touch gestures to let WebViews scroll naturally)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            if (playlist.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Screen Paired. Waiting for content...",
                        color = Color(0xFF94A3B8),
                        fontSize = 18.sp
                    )
                }
            } else {
                // Sequential/Shuffled playlist engine
                PlaylistEngine(
                    playlist = playlist,
                    scaleMode = config.scaleMode,
                    isMuted = config.isMuted,
                    loopEnabled = config.loopEnabled,
                    shuffleEnabled = config.shuffleEnabled,
                    onActiveItemChanged = { item ->
                        activeItem = item
                        lastPlaybackError = null
                    },
                    onPlaybackError = { error ->
                        lastPlaybackError = error
                        activeItem?.let {
                            viewModel.updateServicePlayingStatus(
                                isPlaying = true,
                                currentItemId = it.id,
                                lastError = error
                            )
                        }
                    }
                )
            }

            // Keep service updated about active item playing state
            LaunchedEffect(activeItem) {
                activeItem?.let {
                    viewModel.updateServicePlayingStatus(
                        isPlaying = true,
                        currentItemId = it.id,
                        lastError = lastPlaybackError
                    )
                }
            }

            // Overlay & Menu Controls
            ControlOverlay(
                visible = isOverlayVisible,
                isFullscreen = isFullscreen,
                onFullscreenToggle = onFullscreenToggle,
                onMenuClick = { onSidebarToggle(true) }
            )
        }
    }
}
