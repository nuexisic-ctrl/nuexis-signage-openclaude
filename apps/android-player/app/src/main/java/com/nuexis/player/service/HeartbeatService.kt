package com.nuexis.player.service

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.nuexis.player.data.remote.SupabaseApi
import kotlinx.coroutines.*
import java.io.File

class HeartbeatService : Service() {

    companion object {
        private const val TAG = "HeartbeatService"
        private const val NOTIFICATION_CHANNEL_ID = "nuexis_player_heartbeat"
        private const val NOTIFICATION_ID = 45112

        // Intent Actions
        const val ACTION_START = "com.nuexis.player.ACTION_START"
        const val ACTION_UPDATE_STATUS = "com.nuexis.player.ACTION_UPDATE_STATUS"
        const val ACTION_STOP = "com.nuexis.player.ACTION_STOP"

        // Intent Extras
        const val EXTRA_DEVICE_ID = "extra_device_id"
        const val EXTRA_HARDWARE_ID = "extra_hardware_id"
        const val EXTRA_SECRET = "extra_secret"
        const val EXTRA_SESSION_TOKEN = "extra_session_token"
        const val EXTRA_MANIFEST_VERSION = "extra_manifest_version"
        const val EXTRA_CURRENT_ITEM_ID = "extra_current_item_id"
        const val EXTRA_LAST_ERROR = "extra_last_error"
        const val EXTRA_IS_PLAYING = "extra_is_playing"
    }

    private val api = SupabaseApi()
    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    
    private var heartbeatJob: Job? = null
    private var playtimeJob: Job? = null

    // Player state parameters
    private var deviceId: String? = null
    private var hardwareId: String? = null
    private var secret: String? = null
    private var sessionToken: String? = null
    
    private var manifestVersion: String? = null
    private var currentItemId: String? = null
    private var lastError: String? = null
    private var isPlaying: Boolean = false

    private var accumulatedPlaytimeSeconds = 0

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_STICKY

        when (intent.action) {
            ACTION_START -> {
                deviceId = intent.getStringExtra(EXTRA_DEVICE_ID)
                hardwareId = intent.getStringExtra(EXTRA_HARDWARE_ID)
                secret = intent.getStringExtra(EXTRA_SECRET)
                sessionToken = intent.getStringExtra(EXTRA_SESSION_TOKEN)
                
                isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false)
                manifestVersion = intent.getStringExtra(EXTRA_MANIFEST_VERSION)
                currentItemId = intent.getStringExtra(EXTRA_CURRENT_ITEM_ID)
                lastError = intent.getStringExtra(EXTRA_LAST_ERROR)

                startForeground(NOTIFICATION_ID, createNotification())
                startMonitoring()
            }
            ACTION_UPDATE_STATUS -> {
                isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, isPlaying)
                manifestVersion = intent.getStringExtra(EXTRA_MANIFEST_VERSION) ?: manifestVersion
                currentItemId = intent.getStringExtra(EXTRA_CURRENT_ITEM_ID) ?: currentItemId
                lastError = intent.getStringExtra(EXTRA_LAST_ERROR) ?: lastError
                sessionToken = intent.getStringExtra(EXTRA_SESSION_TOKEN) ?: sessionToken
                Log.d(TAG, "Status updated: isPlaying=$isPlaying, manifest=$manifestVersion, item=$currentItemId, error=$lastError")
            }
            ACTION_STOP -> {
                stopForeground(true)
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.d(TAG, "Stopping Heartbeat Service")
        flushPlaytimeSync() // Attempt to flush playtime on destroy
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun startMonitoring() {
        // 1. Heartbeat loop (every 60 seconds)
        heartbeatJob?.cancel()
        heartbeatJob = serviceScope.launch {
            while (isActive) {
                sendHeartbeat()
                delay(60000L) // 1 minute
            }
        }

        // 2. Playtime counter (runs every second, accumulates and flushes)
        playtimeJob?.cancel()
        playtimeJob = serviceScope.launch {
            var cycles = 0
            while (isActive) {
                delay(1000L)
                if (isPlaying) {
                    accumulatedPlaytimeSeconds++
                }
                cycles++
                
                // Flush every 15 minutes (900 seconds)
                if (cycles >= 900) {
                    cycles = 0
                    flushPlaytime()
                }
            }
        }
    }

    private suspend fun sendHeartbeat() {
        val devId = deviceId ?: return
        val sToken = sessionToken ?: return

        val freeDisk = getFreeDiskBytes()
        val memClass = getMemoryClassMb()
        val netType = getNetworkTypeString()
        val appVer = getAppVersionString()
        val osVer = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

        Log.d(TAG, "Sending heartbeat: devId=$devId, version=$manifestVersion, freeDisk=$freeDisk")

        val success = api.reportDeviceHealth(
            deviceId = devId,
            sessionToken = sToken,
            appVersion = appVer,
            osVersion = osVer,
            freeDiskBytes = freeDisk,
            memoryClassMb = memClass,
            networkType = netType,
            manifestVersion = manifestVersion,
            currentItemId = currentItemId,
            lastError = lastError
        )

        if (success) {
            Log.d(TAG, "Heartbeat sent successfully")
        } else {
            Log.w(TAG, "Heartbeat failed to send")
        }
    }

    private suspend fun flushPlaytime() {
        val devId = deviceId ?: return
        val hwId = hardwareId ?: return
        val sec = secret ?: return
        val secondsToFlush = accumulatedPlaytimeSeconds

        if (secondsToFlush <= 0) return

        Log.d(TAG, "Flushing playtime: $secondsToFlush seconds")
        accumulatedPlaytimeSeconds = 0

        val success = api.incrementDevicePlaytime(
            deviceId = devId,
            hardwareId = hwId,
            secret = sec,
            seconds = secondsToFlush
        )

        if (success) {
            Log.d(TAG, "Playtime flushed successfully")
        } else {
            // Re-accumulate if failed
            accumulatedPlaytimeSeconds += secondsToFlush
            Log.w(TAG, "Playtime flush failed, deferred")
        }
    }

    private fun flushPlaytimeSync() {
        val devId = deviceId ?: return
        val hwId = hardwareId ?: return
        val sec = secret ?: return
        val secondsToFlush = accumulatedPlaytimeSeconds
        if (secondsToFlush <= 0) return

        runBlocking {
            withTimeoutOrNull(3000) {
                api.incrementDevicePlaytime(devId, hwId, sec, secondsToFlush)
            }
        }
    }

    // ── Diagnostics utility functions ──

    private fun getFreeDiskBytes(): Long {
        return try {
            val file = File(filesDir.absolutePath)
            file.freeSpace
        } catch (e: Exception) {
            -1L
        }
    }

    private fun getMemoryClassMb(): Int {
        return try {
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            activityManager.memoryClass
        } catch (e: Exception) {
            -1
        }
    }

    private fun getNetworkTypeString(): String {
        return try {
            val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = connectivityManager.activeNetwork ?: return "OFFLINE"
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return "OFFLINE"

            return when {
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
                else -> "UNKNOWN"
            }
        } catch (e: Exception) {
            "ERROR"
        }
    }

    private fun getAppVersionString(): String {
        return try {
            val pInfo = packageManager.getPackageInfo(packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    // ── Foreground Notification Setup ──

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "NuExis Player Heartbeat Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("NuExis Signage Player")
            .setContentText("Player background connection is active.")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }
}
