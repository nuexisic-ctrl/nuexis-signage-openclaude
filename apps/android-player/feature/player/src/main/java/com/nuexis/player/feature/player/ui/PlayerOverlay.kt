package com.nuexis.player.feature.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

@Composable
fun PlayerOverlay(
    viewModel: PlayerViewModel,
    onReloadPlayer: () -> Unit
) {
    var isSidebarOpen by remember { mutableStateOf(false) }
    var tapCount by remember { mutableStateOf(0) }
    var lastTapTime by remember { mutableStateOf(0L) }
    var showControlsOverlay by remember { mutableStateOf(false) }

    val deviceState by viewModel.deviceStateFlow.collectAsState(initial = null)

    // Reset tap count if too much time passes between taps
    LaunchedEffect(tapCount) {
        if (tapCount > 0 && tapCount < 5) {
            delay(500) // half second timeout
            tapCount = 0
        }
    }

    // Auto-hide controls overlay
    LaunchedEffect(showControlsOverlay) {
        if (showControlsOverlay && !isSidebarOpen) {
            delay(3000)
            showControlsOverlay = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = {
                        showControlsOverlay = true
                        val now = System.currentTimeMillis()
                        if (now - lastTapTime < 500) {
                            tapCount++
                        } else {
                            tapCount = 1
                        }
                        lastTapTime = now
                        if (tapCount >= 5) {
                            isSidebarOpen = true
                            tapCount = 0
                        }
                    }
                )
            }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onHorizontalDrag = { change, dragAmount ->
                        if (dragAmount > 20) { // Swipe right
                            isSidebarOpen = true
                        } else if (dragAmount < -20) { // Swipe left
                            isSidebarOpen = false
                        }
                    }
                )
            }
    ) {
        // Overlay Controls (top-left) matching web player
        AnimatedVisibility(
            visible = showControlsOverlay && !isSidebarOpen,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Row(
                modifier = Modifier
                    .padding(24.dp)
                    .align(Alignment.TopStart)
            ) {
                OverlayIconButton(icon = Icons.Default.Fullscreen, onClick = { /* Fullscreen handles implicitly in Android */ })
                Spacer(modifier = Modifier.width(12.dp))
                OverlayIconButton(icon = Icons.Default.MoreVert, onClick = { isSidebarOpen = true })
            }
        }

        // Sidebar
        AnimatedVisibility(
            visible = isSidebarOpen,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.4f))
                    .clickable { isSidebarOpen = false }
            )
        }

        AnimatedVisibility(
            visible = isSidebarOpen,
            enter = slideInHorizontally(initialOffsetX = { -it }),
            exit = slideOutHorizontally(targetOffsetX = { -it })
        ) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(320.dp)
                    .background(Color(0xFF0F172A))
                    .clickable(enabled = false) {} // block clicks from closing
            ) {
                Column {
                    // Sidebar Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.05f))
                            .padding(24.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "NuExis",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        IconButton(
                            onClick = { isSidebarOpen = false },
                            modifier = Modifier.size(32.dp).clip(CircleShape)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White.copy(alpha = 0.6f))
                        }
                    }

                    // Sidebar Content
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp)
                    ) {
                        SidebarButton(
                            icon = Icons.Default.Refresh,
                            label = "Refresh Content",
                            onClick = {
                                viewModel.refreshContent()
                                isSidebarOpen = false
                            }
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        SidebarButton(
                            icon = Icons.Default.Refresh, // Using refresh as placeholder for reload
                            label = "Reload Player",
                            onClick = {
                                onReloadPlayer()
                                isSidebarOpen = false
                            }
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        // Device Info
                        Text("DEVICE INFO", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(8.dp))
                        DeviceInfoRow("Name", deviceState?.name ?: "Unknown")
                        DeviceInfoRow("ID", deviceState?.id?.take(8) ?: "N/A")
                        DeviceInfoRow("Status", deviceState?.status ?: "Offline")
                    }
                }
            }
        }
    }
}

@Composable
fun OverlayIconButton(icon: ImageVector, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(Color(0xFF0F172A).copy(alpha = 0.88f))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = Color.White.copy(alpha = 0.85f))
    }
}

@Composable
fun SidebarButton(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = Color.White.copy(alpha = 0.6f), modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Text(label, color = Color.White, fontSize = 15.sp)
    }
}

@Composable
fun DeviceInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Color.White.copy(alpha = 0.5f), fontSize = 14.sp)
        Text(value, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
