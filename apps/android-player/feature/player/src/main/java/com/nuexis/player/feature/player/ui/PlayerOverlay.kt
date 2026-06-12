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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.text.style.TextAlign
import com.nuexis.player.core.domain.model.DownloadStatus
import com.nuexis.player.core.domain.sync.AssetDiagnostic


@Composable
fun PlayerOverlay(
    viewModel: PlayerViewModel,
    onReloadPlayer: () -> Unit
) {
    var isSidebarOpen by remember { mutableStateOf(false) }
    var tapCount by remember { mutableStateOf(0) }
    var lastTapTime by remember { mutableStateOf(0L) }
    var showControlsOverlay by remember { mutableStateOf(false) }
    var showUnpairDialog by remember { mutableStateOf(false) }
    var showOrientationDialog by remember { mutableStateOf(false) }
    var showDiagnosticsDialog by remember { mutableStateOf(false) }
    var isErrorLogExpanded by remember { mutableStateOf(false) }

    val deviceState by viewModel.deviceStateFlow.collectAsState(initial = null)
    val uiState by viewModel.uiState.collectAsState()
    val isMuted by viewModel.isMuted.collectAsState()
    val errorLog by viewModel.errorLog.collectAsState()
    val diagnostics by viewModel.diagnostics.collectAsState(initial = emptyMap())
    
    val currentOrientation = deviceState?.orientation ?: 0
    val isPlaying = uiState is PlayerUiState.PlayingVideo || 
                    uiState is PlayerUiState.PlayingImage || 
                    uiState is PlayerUiState.PlayingWebsite


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
                        if (isPlaying) {
                            showControlsOverlay = true
                        }
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
            visible = showControlsOverlay && !isSidebarOpen && isPlaying,
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
                // Changed from MoreVert to Menu (hamburger menu)
                OverlayIconButton(icon = Icons.Default.Menu, onClick = { isSidebarOpen = true })
            }
        }

        // Sidebar Background Dimming
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

        // Sidebar Panel
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
                Column(
                    modifier = Modifier
                        .fillMaxHeight()
                        .verticalScroll(rememberScrollState())
                ) {
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
                            text = "NuExis Player",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        IconButton(
                            onClick = { isSidebarOpen = false },
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
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
                        // Device Actions Section
                        Text(
                            text = "DEVICE ACTIONS",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        
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
                            icon = Icons.Default.Info,
                            label = "Diagnostics",
                            onClick = {
                                showDiagnosticsDialog = true
                            }
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        SidebarButton(
                            icon = Icons.Default.Refresh,
                            label = "Reload Player",
                            onClick = {
                                onReloadPlayer()
                                isSidebarOpen = false
                            }
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        // Mute/Unmute Audio
                        SidebarButton(
                            icon = if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                            label = if (isMuted) "Unmute Audio" else "Mute Audio",
                            onClick = {
                                viewModel.toggleMute()
                            }
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        // Device Orientation
                        val orientationLabel = when (currentOrientation) {
                            90 -> "Orientation: 90° CW"
                            180 -> "Orientation: 180°"
                            270 -> "Orientation: 270° CCW"
                            else -> "Orientation: 0°"
                        }
                        SidebarButton(
                            icon = Icons.Default.ScreenRotation,
                            label = orientationLabel,
                            onClick = {
                                showOrientationDialog = true
                            }
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        // Unpair Device (Danger button)
                        SidebarButton(
                            icon = Icons.Default.DeleteForever,
                            label = "Unpair Device",
                            tint = Color(0xFFEF4444),
                            onClick = {
                                showUnpairDialog = true
                            }
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        // Device Info
                        Text(
                            text = "DEVICE INFO",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        DeviceInfoRow("Name", deviceState?.name ?: "Unknown")
                        DeviceInfoRow("ID", deviceState?.id?.take(8) ?: "N/A")
                        DeviceInfoRow("Status", deviceState?.status ?: "Offline")
                        
                        // Error Log (Collapsible, developer/debug feedback)
                        if (errorLog.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(24.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { isErrorLogExpanded = !isErrorLogExpanded }
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "ERROR LOG (${errorLog.size})",
                                    color = Color(0xFFEF4444),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Icon(
                                    imageVector = if (isErrorLogExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = null,
                                    tint = Color(0xFFEF4444),
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            
                            if (isErrorLogExpanded) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color.Black.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
                                        .padding(8.dp)
                                ) {
                                    errorLog.forEach { errorMsg ->
                                        Text(
                                            text = errorMsg,
                                            color = Color(0xFFFCA5A5),
                                            fontSize = 11.sp,
                                            modifier = Modifier.padding(vertical = 2.dp),
                                            maxLines = 3,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Unpair Confirmation Dialog
    if (showUnpairDialog) {
        AlertDialog(
            onDismissRequest = { showUnpairDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "Unpair Device", color = Color.White)
                }
            },
            text = {
                Text(
                    text = "Are you sure you want to unpair this device? This will clear all local cache and remove the screen registration from the workspace. You will need to pair it again to use it.",
                    color = Color.White.copy(alpha = 0.8f)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showUnpairDialog = false
                        isSidebarOpen = false
                        viewModel.unpairDevice()
                    }
                ) {
                    Text("Unpair", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showUnpairDialog = false }
                ) {
                    Text("Cancel", color = Color.White.copy(alpha = 0.6f))
                }
            },
            containerColor = Color(0xFF1E293B),
            textContentColor = Color.White
        )
    }

    // Orientation Picker Dialog
    if (showOrientationDialog) {
        AlertDialog(
            onDismissRequest = { showOrientationDialog = false },
            title = {
                Text(text = "Select Orientation", color = Color.White)
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    val options = listOf(
                        0 to "0° — Landscape",
                        90 to "90° — Portrait CW",
                        180 to "180° — Landscape Flipped",
                        270 to "270° — Portrait CCW"
                    )
                    options.forEach { (angle, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(6.dp))
                                .clickable {
                                    showOrientationDialog = false
                                    viewModel.updateOrientation(angle)
                                }
                                .padding(vertical = 12.dp, horizontal = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = label, color = Color.White)
                            if (currentOrientation == angle) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Selected",
                                    tint = Color(0xFF3B82F6),
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(
                    onClick = { showOrientationDialog = false }
                ) {
                    Text("Close", color = Color.White.copy(alpha = 0.6f))
                }
            },
            containerColor = Color(0xFF1E293B)
        )
        // Error State Overlay Panel
        if (uiState is PlayerUiState.Error) {
            val errorState = uiState as PlayerUiState.Error
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.85f))
                    .clickable(enabled = true, onClick = {}), // intercept click to prevent closing sidebar or triggering tap detection
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .width(420.dp)
                        .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                        .border(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                        .padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Playback Interrupted",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = errorState.message,
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        TextButton(
                            onClick = { showDiagnosticsDialog = true },
                            modifier = Modifier
                                .weight(1f)
                                .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                        ) {
                            Text("Diagnostics", color = Color.White)
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        TextButton(
                            onClick = { viewModel.retryPlayback() },
                            modifier = Modifier
                                .weight(1f)
                                .background(Color(0xFF2563EB), RoundedCornerShape(6.dp))
                        ) {
                            Text("Retry", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    // Diagnostics Dialog
    if (showDiagnosticsDialog) {
        DiagnosticsDialog(
            diagnostics = diagnostics,
            onDismiss = { showDiagnosticsDialog = false },
            onRetry = {
                viewModel.retryPlayback()
                showDiagnosticsDialog = false
            }
        )
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
fun SidebarButton(
    icon: ImageVector, 
    label: String, 
    tint: Color = Color.White,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = tint.copy(alpha = 0.8f), modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Text(label, color = tint, fontSize = 15.sp)
    }
}

@Composable
fun DeviceInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Color.White.copy(alpha = 0.5f), fontSize = 14.sp)
        Text(value, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun DiagnosticsDialog(
    diagnostics: Map<String, AssetDiagnostic>,
    onDismiss: () -> Unit,
    onRetry: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "System Diagnostics",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                TextButton(
                    onClick = onRetry,
                    modifier = Modifier
                        .background(Color(0xFF2563EB), RoundedCornerShape(6.dp))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text("Retry Sync", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.75f)
            ) {
                if (diagnostics.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No assets tracked in current session.",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 14.sp
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                    ) {
                        diagnostics.values.forEach { diagnostic ->
                            AssetDiagnosticCard(diagnostic)
                            Spacer(modifier = Modifier.height(12.dp))
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = Color.White.copy(alpha = 0.6f))
            }
        },
        containerColor = Color(0xFF0F172A),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(0.95f)
    )
}

@Composable
fun AssetDiagnosticCard(diagnostic: AssetDiagnostic) {
    var isExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1E293B), RoundedCornerShape(8.dp))
            .border(1.dp, Color.White.copy(alpha = 0.05f), RoundedCornerShape(8.dp))
            .clickable { isExpanded = !isExpanded }
            .padding(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = diagnostic.fileName,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "ID: ${diagnostic.id.take(8)}...",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 11.sp
                )
            }
            
            val (statusText, statusBg, statusFg) = when (diagnostic.status) {
                DownloadStatus.COMPLETED -> Triple("COMPLETED", Color(0xFF10B981).copy(alpha = 0.15f), Color(0xFF34D399))
                DownloadStatus.DOWNLOADING -> Triple("DOWNLOADING", Color(0xFF3B82F6).copy(alpha = 0.15f), Color(0xFF60A5FA))
                DownloadStatus.PENDING -> Triple("PENDING", Color(0xFFF59E0B).copy(alpha = 0.15f), Color(0xFFFBBF24))
                DownloadStatus.FAILED -> Triple("FAILED", Color(0xFFEF4444).copy(alpha = 0.15f), Color(0xFFF87171))
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(statusBg)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = statusText,
                    color = statusFg,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        if (isExpanded) {
            Spacer(modifier = Modifier.height(12.dp))
            
            // Detail grid
            val formattedSize = if (diagnostic.sizeBytes > 0) {
                String.format("%.2f MB", diagnostic.sizeBytes / (1024.0 * 1024.0))
            } else {
                "Unknown"
            }
            
            val formattedDuration = if (diagnostic.downloadDurationMs > 0) {
                String.format("%.2fs", diagnostic.downloadDurationMs / 1000.0)
            } else {
                "N/A"
            }

            val formattedSpeed = if (diagnostic.downloadSpeedKbps > 0) {
                String.format("%.1f Kbps", diagnostic.downloadSpeedKbps)
            } else {
                "N/A"
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                    .padding(10.dp)
            ) {
                DiagnosticDetailRow("MIME Type", diagnostic.mimeType)
                DiagnosticDetailRow("Size", formattedSize)
                DiagnosticDetailRow("Duration", formattedDuration)
                DiagnosticDetailRow("Speed", formattedSpeed)
                DiagnosticDetailRow("HTTP Status", if (diagnostic.httpStatus > 0) diagnostic.httpStatus.toString() else "N/A")
                
                diagnostic.url?.let {
                    DiagnosticDetailRow("Source URL", it, wrap = true)
                }

                diagnostic.lastError?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Last Error:",
                        color = Color(0xFFF87171),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = it,
                        color = Color(0xFFFCA5A5),
                        fontSize = 10.sp,
                        lineHeight = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
fun DiagnosticDetailRow(label: String, value: String, wrap: Boolean = false) {
    Column(modifier = Modifier.padding(vertical = 2.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Text(label, color = Color.White.copy(alpha = 0.4f), fontSize = 11.sp)
            if (!wrap) {
                Text(value, color = Color.White.copy(alpha = 0.85f), fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
        }
        if (wrap) {
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = value,
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 10.sp,
                lineHeight = 13.sp
            )
        }
    }
}
