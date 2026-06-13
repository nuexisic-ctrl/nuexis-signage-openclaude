package com.nuexis.player.ui.pairing

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

@Composable
fun PairingScreen(
    code: String,
    remainingMs: Long,
    isRegistering: Boolean = false
) {
    val totalDurationMs = 600000.0f // 10 minutes
    val progress = (remainingMs / totalDurationMs).coerceIn(0.0f, 1.0f)
    val animatedProgress by animateFloatAsState(targetValue = progress, label = "ProgressAnim")

    val isUrgent = remainingMs < 120000L // Less than 2 minutes
    val primaryColor = Color(0xFF3B82F6)
    val urgentColor = Color(0xFFEF4444)
    val progressColor = if (isUrgent) urgentColor else primaryColor

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07111F)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .widthIn(max = 500.dp)
                .padding(32.dp)
        ) {
            // NuExis Logo
            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(color = Color.White, fontWeight = FontWeight.Bold)) {
                        append("Nu")
                    }
                    withStyle(style = SpanStyle(color = primaryColor, fontWeight = FontWeight.Bold)) {
                        append("Exis")
                    }
                },
                fontSize = 42.sp,
                fontFamily = FontFamily.SansSerif,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(bottom = 36.dp)
            )

            Text(
                text = "Pairing Code",
                color = Color(0xFF94A3B8),
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // Code Display Box
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFF0E1E33))
                    .padding(horizontal = 24.dp)
            ) {
                if (isRegistering || code.isEmpty()) {
                    Text(
                        text = "GENERATING...",
                        color = Color(0xFF475569),
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 4.sp
                    )
                } else {
                    // Render code in spaced characters
                    val spacedCode = code.map { it.toString() }.joinToString(" ")
                    Text(
                        text = spacedCode,
                        color = Color.White,
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 6.sp,
                        fontFamily = FontFamily.Monospace,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Countdown Timer Row
            if (code.isNotEmpty() && !isRegistering) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = "Timer",
                        tint = Color(0xFF64748B),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Code expires in ",
                        color = Color(0xFF64748B),
                        fontSize = 14.sp
                    )
                    Text(
                        text = formatTime(remainingMs),
                        color = progressColor,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Progress Bar
                LinearProgressIndicator(
                    progress = { animatedProgress },
                    color = progressColor,
                    trackColor = Color(0xFF1E293B),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                )
            }

            Spacer(modifier = Modifier.height(44.dp))

            // Instructions Box
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Enter this code in your NuExis dashboard to pair this screen.",
                    color = Color(0xFF94A3B8),
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )
                Spacer(modifier = Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF1E293B))
                        .padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "Dashboard → Screens → Add Screen",
                        color = primaryColor,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }
            }
        }
    }
}

private fun formatTime(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format(Locale.US, "%02d:%02d", minutes, seconds)
}
