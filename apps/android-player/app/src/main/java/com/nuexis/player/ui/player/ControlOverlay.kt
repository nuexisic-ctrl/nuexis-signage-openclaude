package com.nuexis.player.ui.player

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun ControlOverlay(
    visible: Boolean,
    isFullscreen: Boolean,
    onFullscreenToggle: (Boolean) -> Unit,
    onMenuClick: () -> Unit
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = Modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            // Align individual control buttons to top-right with a gap of 12.dp
            Row(
                modifier = Modifier
                    .align(Alignment.TopEnd),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                IconButton(
                    onClick = { onFullscreenToggle(!isFullscreen) },
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = Color(0xDF0F172A),
                        contentColor = Color(0xD9FFFFFF)
                    ),
                    modifier = Modifier
                        .size(44.dp)
                        .shadow(elevation = 6.dp, shape = CircleShape)
                ) {
                    Icon(
                        imageVector = if (isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                        contentDescription = if (isFullscreen) "Exit Fullscreen" else "Enter Fullscreen",
                        modifier = Modifier.size(24.dp)
                    )
                }

                IconButton(
                    onClick = onMenuClick,
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = Color(0xDF0F172A),
                        contentColor = Color(0xD9FFFFFF)
                    ),
                    modifier = Modifier
                        .size(44.dp)
                        .shadow(elevation = 6.dp, shape = CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Menu,
                        contentDescription = "Open Sidebar Menu",
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}
