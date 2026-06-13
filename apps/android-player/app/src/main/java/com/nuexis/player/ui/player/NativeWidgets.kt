package com.nuexis.player.ui.player

import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay
import java.util.*
import kotlin.math.cos
import kotlin.math.sin

private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

// ── 1. NATIVE CLOCK WIDGET ──

@Serializable
data class ClockWidgetConfig(
    val style: String = "classic-digital",
    val showSeconds: Boolean = true,
    val showDate: Boolean = true,
    val use24Hour: Boolean = false,
    val dateFormat: String = "MMMM dd, yyyy",
    val theme: String = "dark"
)

@Composable
fun NativeClockWidget(configStr: String?) {
    val config = remember(configStr) {
        try {
            if (configStr != null) json.decodeFromString<ClockWidgetConfig>(configStr)
            else ClockWidgetConfig()
        } catch (e: Exception) {
            Log.e("NativeClockWidget", "Error parsing config", e)
            ClockWidgetConfig()
        }
    }

    var time by remember { mutableStateOf(Calendar.getInstance()) }

    // Smooth second ticker loop
    LaunchedEffect(Unit) {
        while (true) {
            time = Calendar.getInstance()
            delay(100L) // Refresh frequently for analog hand sweep accuracy
        }
    }

    val isDark = config.theme == "dark" || config.style == "modern-digital" || config.style == "modern-analog"
    val bgColor = if (isDark) Color(0xFF07111F) else Color.White
    val textColor = if (isDark) Color.White else Color(0xFF0F172A)
    val accentColor = Color(0xFF3B82F6)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        when (config.style) {
            "classic-digital", "modern-digital", "minimalist" -> {
                DigitalClockLayout(time, config, textColor, accentColor)
            }
            "classic-analog", "modern-analog" -> {
                AnalogClockLayout(time, config, textColor, bgColor, accentColor)
            }
            else -> {
                DigitalClockLayout(time, config, textColor, accentColor)
            }
        }
    }
}

@Composable
private fun DigitalClockLayout(
    time: Calendar,
    config: ClockWidgetConfig,
    textColor: Color,
    accentColor: Color
) {
    val isModern = config.style == "modern-digital"
    val hour = time.get(if (config.use24Hour) Calendar.HOUR_OF_DAY else Calendar.HOUR)
    val hourStr = if (config.use24Hour) String.format(Locale.US, "%02d", hour) else (if (hour == 0) "12" else hour.toString())
    val minute = String.format(Locale.US, "%02d", time.get(Calendar.MINUTE))
    val second = String.format(Locale.US, "%02d", time.get(Calendar.SECOND))
    val ampm = if (time.get(Calendar.AM_PM) == Calendar.AM) "AM" else "PM"

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Row(
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = "$hourStr:$minute",
                color = textColor,
                fontSize = 110.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.SansSerif,
                letterSpacing = (-2).sp
            )

            if (config.showSeconds) {
                Text(
                    text = ":$second",
                    color = if (isModern) accentColor else textColor.copy(alpha = 0.7f),
                    fontSize = 55.sp,
                    fontWeight = FontWeight.Medium,
                    fontFamily = FontFamily.SansSerif,
                    modifier = Modifier.padding(bottom = 18.dp)
                )
            }

            if (!config.use24Hour) {
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = ampm,
                    color = if (isModern) accentColor else textColor.copy(alpha = 0.7f),
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.SansSerif,
                    modifier = Modifier.padding(bottom = 18.dp)
                )
            }
        }

        if (config.showDate) {
            val dateFmt = try {
                SimpleDateFormat(config.dateFormat, Locale.getDefault())
            } catch (e: Exception) {
                SimpleDateFormat("MMMM dd, yyyy", Locale.getDefault())
            }
            Text(
                text = dateFmt.format(time.time).uppercase(Locale.getDefault()),
                color = textColor.copy(alpha = 0.6f),
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(top = 10.dp)
            )
        }
    }
}

@Composable
private fun AnalogClockLayout(
    time: Calendar,
    config: ClockWidgetConfig,
    textColor: Color,
    bgColor: Color,
    accentColor: Color
) {
    val isModern = config.style == "modern-analog"
    
    val hours = time.get(Calendar.HOUR)
    val minutes = time.get(Calendar.MINUTE)
    val seconds = time.get(Calendar.SECOND)
    val ms = time.get(Calendar.MILLISECOND)

    // Compute sweep angle
    val secAngle = (seconds * 6f) + (ms * 0.006f)
    val minAngle = (minutes * 6f) + (secAngle / 60f)
    val hourAngle = (hours * 30f) + (minAngle / 12f)

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier.size(320.dp),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val center = Offset(size.width / 2, size.height / 2)
                val radius = size.width / 2 * 0.85f

                // Draw outer dial border
                drawCircle(
                    color = textColor.copy(alpha = 0.15f),
                    radius = radius,
                    center = center,
                    style = Stroke(width = if (isModern) 2.dp.toPx() else 4.dp.toPx())
                )

                // Draw hour notches
                for (i in 0 until 12) {
                    val angle = i * 30 * Math.PI / 180
                    val startRadius = radius * 0.88f
                    val endRadius = radius * 0.96f
                    
                    val startX = (center.x + startRadius * sin(angle)).toFloat()
                    val startY = (center.y - startRadius * cos(angle)).toFloat()
                    val endX = (center.x + endRadius * sin(angle)).toFloat()
                    val endY = (center.y - endRadius * cos(angle)).toFloat()

                    drawLine(
                        color = if (i % 3 == 0) textColor else textColor.copy(alpha = 0.4f),
                        start = Offset(startX, startY),
                        end = Offset(endX, endY),
                        strokeWidth = if (i % 3 == 0) 3.dp.toPx() else 1.5.dp.toPx(),
                        cap = StrokeCap.Round
                    )
                }

                // Draw Hour hand
                val hourLen = radius * 0.5f
                val hourRad = hourAngle * Math.PI / 180
                val hourEndX = (center.x + hourLen * sin(hourRad)).toFloat()
                val hourEndY = (center.y - hourLen * cos(hourRad)).toFloat()
                drawLine(
                    color = textColor,
                    start = center,
                    end = Offset(hourEndX, hourEndY),
                    strokeWidth = 6.dp.toPx(),
                    cap = StrokeCap.Round
                )

                // Draw Minute hand
                val minLen = radius * 0.75f
                val minRad = minAngle * Math.PI / 180
                val minEndX = (center.x + minLen * sin(minRad)).toFloat()
                val minEndY = (center.y - minLen * cos(minRad)).toFloat()
                drawLine(
                    color = textColor.copy(alpha = 0.85f),
                    start = center,
                    end = Offset(minEndX, minEndY),
                    strokeWidth = 4.dp.toPx(),
                    cap = StrokeCap.Round
                )

                // Draw Second hand
                if (config.showSeconds) {
                    val secLen = radius * 0.82f
                    val secRad = secAngle * Math.PI / 180
                    val secEndX = (center.x + secLen * sin(secRad)).toFloat()
                    val secEndY = (center.y - secLen * cos(secRad)).toFloat()
                    drawLine(
                        color = accentColor,
                        start = center,
                        end = Offset(secEndX, secEndY),
                        strokeWidth = 2.dp.toPx(),
                        cap = StrokeCap.Round
                    )
                }

                // Draw center hub pin
                drawCircle(
                    color = bgColor,
                    radius = 5.dp.toPx(),
                    center = center
                )
                drawCircle(
                    color = if (config.showSeconds) accentColor else textColor,
                    radius = 3.dp.toPx(),
                    center = center
                )
            }
        }

        if (config.showDate) {
            val dateFmt = try {
                SimpleDateFormat(config.dateFormat, Locale.getDefault())
            } catch (e: Exception) {
                SimpleDateFormat("MMMM dd, yyyy", Locale.getDefault())
            }
            Text(
                text = dateFmt.format(time.time).uppercase(Locale.getDefault()),
                color = textColor.copy(alpha = 0.5f),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 16.dp)
            )
        }
    }
}

// ── 2. NATIVE COUNTDOWN WIDGET ──

@Serializable
data class CountdownWidgetConfig(
    val text: String = "",
    val endTime: String = "",
    val endMessage: String = "TIME\'S UP!",
    val timerStyle: String = "classic",
    val daysOnly: Boolean = false,
    val theme: String = "dark"
)

@Composable
fun NativeCountdownWidget(configStr: String?) {
    val config = remember(configStr) {
        try {
            if (configStr != null) json.decodeFromString<CountdownWidgetConfig>(configStr)
            else CountdownWidgetConfig()
        } catch (e: Exception) {
            Log.e("NativeCountdownWidget", "Error parsing config", e)
            CountdownWidgetConfig()
        }
    }

    var diffMs by remember { mutableStateOf(0L) }
    
    // Countdown calculation loop
    LaunchedEffect(config.endTime) {
        while (true) {
            val target = try {
                val isoFmt = DateTimeFormatter.ISO_DATE_TIME
                val zonedDateTime = ZonedDateTime.parse(config.endTime, isoFmt)
                zonedDateTime.toInstant().toEpochMilli()
            } catch (e: Exception) {
                0L
            }
            diffMs = target - System.currentTimeMillis()
            delay(500L)
        }
    }

    val isDark = config.theme == "dark"
    val bgColor = if (isDark) Color(0xFF07111F) else Color.White
    val textColor = if (isDark) Color.White else Color(0xFF0F172A)
    val accentColor = Color(0xFF3B82F6)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            // Label
            if (config.text.isNotEmpty()) {
                Text(
                    text = config.text.uppercase(Locale.getDefault()),
                    color = textColor.copy(alpha = 0.6f),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))
            }

            if (diffMs <= 0) {
                // Time's Up
                Text(
                    text = config.endMessage,
                    color = accentColor,
                    fontSize = 60.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    lineHeight = 70.sp
                )
            } else {
                val days = diffMs / 86400000
                val hours = (diffMs % 86400000) / 3600000
                val minutes = (diffMs % 3600000) / 60000
                val seconds = (diffMs % 60000) / 1000

                if (config.daysOnly) {
                    val daysVal = if (diffMs > 0) days + 1 else 0
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = daysVal.toString(),
                            color = textColor,
                            fontSize = 130.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = if (daysVal == 1L) "DAY REMAINING" else "DAYS REMAINING",
                            color = textColor.copy(alpha = 0.5f),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }
                } else {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(24.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TimeBlock(days, "DAYS", textColor)
                        TimeBlock(hours, "HRS", textColor)
                        TimeBlock(minutes, "MINS", textColor)
                        TimeBlock(seconds, "SECS", textColor)
                    }
                }
            }
        }
    }
}

@Composable
private fun TimeBlock(value: Long, label: String, textColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .width(100.dp)
                .height(90.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF0E1E33))
        ) {
            Text(
                text = String.format(Locale.US, "%02d", value),
                color = Color.White,
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.SansSerif
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            color = textColor.copy(alpha = 0.5f),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp
        )
    }
}

// ── 3. NATIVE COUNTUP WIDGET ──

@Serializable
data class CountUpWidgetConfig(
    val text: String = "",
    val startTime: String = "",
    val endMessage: String = "",
    val timerStyle: String = "classic",
    val daysOnly: Boolean = false,
    val theme: String = "dark"
)

@Composable
fun NativeCountUpWidget(configStr: String?) {
    val config = remember(configStr) {
        try {
            if (configStr != null) json.decodeFromString<CountUpWidgetConfig>(configStr)
            else CountUpWidgetConfig()
        } catch (e: Exception) {
            Log.e("NativeCountUpWidget", "Error parsing config", e)
            CountUpWidgetConfig()
        }
    }

    var diffMs by remember { mutableStateOf(0L) }
    
    // CountUp calculation loop
    LaunchedEffect(config.startTime) {
        while (true) {
            val start = try {
                val isoFmt = DateTimeFormatter.ISO_DATE_TIME
                val zonedDateTime = ZonedDateTime.parse(config.startTime, isoFmt)
                zonedDateTime.toInstant().toEpochMilli()
            } catch (e: Exception) {
                0L
            }
            diffMs = System.currentTimeMillis() - start
            delay(500L)
        }
    }

    val isDark = config.theme == "dark"
    val bgColor = if (isDark) Color(0xFF07111F) else Color.White
    val textColor = if (isDark) Color.White else Color(0xFF0F172A)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            // Label
            if (config.text.isNotEmpty()) {
                Text(
                    text = config.text.uppercase(Locale.getDefault()),
                    color = textColor.copy(alpha = 0.6f),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))
            }

            val absDiffMs = if (diffMs < 0) 0L else diffMs
            val days = absDiffMs / 86400000
            val hours = (absDiffMs % 86400000) / 3600000
            val minutes = (absDiffMs % 3600000) / 60000
            val seconds = (absDiffMs % 60000) / 1000

            if (config.daysOnly) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = days.toString(),
                        color = textColor,
                        fontSize = 130.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = if (days == 1L) "DAY ELAPSED" else "DAYS ELAPSED",
                        color = textColor.copy(alpha = 0.5f),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }
            } else {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(24.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TimeBlock(days, "DAYS", textColor)
                    TimeBlock(hours, "HRS", textColor)
                    TimeBlock(minutes, "MINS", textColor)
                    TimeBlock(seconds, "SECS", textColor)
                }
            }
        }
    }
}

// ── 4. NATIVE WORLD CLOCK WIDGET ──

@Serializable
data class WorldClockWidgetConfig(
    val timezone: String = "UTC",
    val clockType: String = "digital",
    val theme: String = "dark",
    val use24Hour: Boolean = false,
    val showSeconds: Boolean = true
)

@Composable
fun NativeWorldClockWidget(configStr: String?) {
    val config = remember(configStr) {
        try {
            if (configStr != null) json.decodeFromString<WorldClockWidgetConfig>(configStr)
            else WorldClockConfigWrapper()
        } catch (e: Exception) {
            Log.e("NativeWorldClockWidget", "Error parsing config", e)
            WorldClockConfigWrapper()
        }
    }

    var time by remember { mutableStateOf(ZonedDateTime.now()) }

    // Smooth ticker
    LaunchedEffect(config.timezone) {
        val zoneId = try {
            ZoneId.of(config.timezone)
        } catch (e: Exception) {
            ZoneId.of("UTC")
        }
        while (true) {
            time = ZonedDateTime.now(zoneId)
            delay(100L)
        }
    }

    val isDark = config.theme == "dark"
    val bgColor = if (isDark) Color(0xFF07111F) else Color.White
    val textColor = if (isDark) Color.White else Color(0xFF0F172A)
    val accentColor = Color(0xFF3B82F6)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Location Header
            val cleanLocation = config.timezone.substringAfter('/').replace('_', ' ').uppercase(Locale.getDefault())
            Text(
                text = cleanLocation,
                color = textColor.copy(alpha = 0.5f),
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            if (config.clockType == "analog") {
                // Renders basic analog wrapper matching config values
                val legacyCalendar = GregorianCalendar.from(time)
                val dummyConfig = ClockWidgetConfig(
                    style = "classic-analog",
                    showSeconds = config.showSeconds,
                    showDate = false,
                    theme = config.theme
                )
                AnalogClockLayout(legacyCalendar, dummyConfig, textColor, bgColor, accentColor)
            } else {
                // Digital
                val hour = if (config.use24Hour) time.hour else (time.hour % 12).let { if (it == 0) 12 else it }
                val hourStr = if (config.use24Hour) String.format(Locale.US, "%02d", hour) else hour.toString()
                val minute = String.format(Locale.US, "%02d", time.minute)
                val second = String.format(Locale.US, "%02d", time.second)
                val ampm = if (time.hour >= 12) "PM" else "AM"

                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "$hourStr:$minute",
                        color = textColor,
                        fontSize = 90.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.SansSerif
                    )

                    if (config.showSeconds) {
                        Text(
                            text = ":$second",
                            color = textColor.copy(alpha = 0.7f),
                            fontSize = 45.sp,
                            fontWeight = FontWeight.Medium,
                            fontFamily = FontFamily.SansSerif,
                            modifier = Modifier.padding(bottom = 14.dp)
                        )
                    }

                    if (!config.use24Hour) {
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = ampm,
                            color = textColor.copy(alpha = 0.7f),
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.SansSerif,
                            modifier = Modifier.padding(bottom = 14.dp)
                        )
                    }
                }
            }
        }
    }
}

// Support class for unparsed configurations
private fun WorldClockConfigWrapper() = WorldClockWidgetConfig()
