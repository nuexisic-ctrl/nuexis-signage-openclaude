package com.nuexis.player.ui.player

import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.nuexis.player.R
import com.nuexis.player.data.local.DeviceConfig

@Composable
fun Sidebar(
    config: DeviceConfig,
    onClose: () -> Unit,
    onRefresh: () -> Unit,
    onMuteToggle: (Boolean) -> Unit,
    onOrientationChange: (Int) -> Unit,
    onLoopToggle: (Boolean) -> Unit,
    onShuffleToggle: (Boolean) -> Unit,
    onUnpair: () -> Unit
) {
    var showOrientationDialog by remember { mutableStateOf(false) }
    var showUnpairConfirmDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
    ) {
        // Header (Matches web header background)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF1E293B).copy(alpha = 0.5f))
                .padding(horizontal = 24.dp, vertical = 18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // NuExis Web Logo image
            Image(
                painter = painterResource(id = R.drawable.nuexis_logo),
                contentDescription = "NuExis Logo",
                modifier = Modifier
                    .width(180.dp)
                    .height(44.dp),
                contentScale = ContentScale.Fit,
                alignment = Alignment.CenterStart
            )

            IconButton(
                onClick = onClose,
                colors = IconButtonDefaults.iconButtonColors(contentColor = Color.White.copy(alpha = 0.7f))
            ) {
                Icon(
                    imageVector = Icons.Default.Close, 
                    contentDescription = "Close Menu",
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        // Sidebar content options
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Actions Section
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "DEVICE ACTIONS",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                
                SidebarButton(
                    text = "Refresh",
                    icon = Icons.Default.Refresh,
                    onClick = {
                        onRefresh()
                        onClose()
                    }
                )

                SidebarButton(
                    text = "Unpair Device",
                    icon = Icons.Default.LinkOff,
                    color = Color(0xFFEF4444), // Danger Color
                    onClick = { showUnpairConfirmDialog = true }
                )
            }

            // Audio Section
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "AUDIO",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )

                SidebarButton(
                    text = if (config.isMuted) "Unmute" else "Mute",
                    icon = if (config.isMuted) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                    onClick = { onMuteToggle(!config.isMuted) }
                )
            }

            // Settings Section
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "ORIENTATION",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )

                val orientationText = when (config.orientation) {
                    90 -> "90° — Portrait CW"
                    180 -> "180° — Landscape Flipped"
                    270 -> "270° — Portrait CCW"
                    else -> "0° — Landscape"
                }

                SidebarButton(
                    text = orientationText,
                    icon = Icons.Default.Tv,
                    onClick = { showOrientationDialog = true }
                )
            }

            // Playlist Settings Section
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "PLAYLIST SETTINGS",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )

                SidebarButton(
                    text = if (config.loopEnabled) "Loop Playlist: ON" else "Loop Playlist: OFF",
                    icon = Icons.Default.Loop,
                    onClick = { onLoopToggle(!config.loopEnabled) }
                )

                SidebarButton(
                    text = if (config.shuffleEnabled) "Shuffle Playlist: ON" else "Shuffle Playlist: OFF",
                    icon = Icons.Default.Shuffle,
                    onClick = { onShuffleToggle(!config.shuffleEnabled) }
                )
            }
        }
    }

    // Orientation selector Dialog
    if (showOrientationDialog) {
        OrientationSelectorDialog(
            currentOrientation = config.orientation,
            onDismiss = { showOrientationDialog = false },
            onSelect = { orientation ->
                onOrientationChange(orientation)
                showOrientationDialog = false
            }
        )
    }

    // Unpair confirmation Dialog
    if (showUnpairConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showUnpairConfirmDialog = false },
            containerColor = Color(0xFF0E1E33),
            title = { Text("Unpair Device?", color = Color.White) },
            text = { Text("Are you sure you want to unpair this screen? This will remove connection to CMS.", color = Color(0xFF94A3B8)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        onUnpair()
                        showUnpairConfirmDialog = false
                        onClose()
                    }
                ) {
                    Text("Unpair", color = Color(0xFFEF4444))
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnpairConfirmDialog = false }) {
                    Text("Cancel", color = Color.White)
                }
            }
        )
    }
}

@Composable
private fun SidebarButton(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color = Color.White,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        color = Color(0xFF1E293B),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                text = text,
                color = color,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun OrientationSelectorDialog(
    currentOrientation: Int,
    onDismiss: () -> Unit,
    onSelect: (Int) -> Unit
) {
    val options = listOf(
        0 to "0° — Landscape",
        90 to "90° — Portrait CW",
        180 to "180° — Landscape Flipped",
        270 to "270° — Portrait CCW"
    )

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = Color(0xFF0E1E33),
            modifier = Modifier
                .width(280.dp)
                .padding(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Select Orientation",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                options.forEach { (valDegrees, label) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = (currentOrientation == valDegrees),
                                onClick = { onSelect(valDegrees) }
                            )
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = (currentOrientation == valDegrees),
                            onClick = { onSelect(valDegrees) },
                            colors = RadioButtonDefaults.colors(
                                selectedColor = Color(0xFF3B82F6),
                                unselectedColor = Color(0xFF475569)
                            )
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = label,
                            color = if (currentOrientation == valDegrees) Color.White else Color(0xFF94A3B8),
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }
    }
}
