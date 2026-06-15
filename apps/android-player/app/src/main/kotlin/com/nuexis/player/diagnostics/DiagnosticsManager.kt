package com.nuexis.player.diagnostics

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.os.StatFs
import android.util.Log
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import kotlinx.coroutines.*

class DiagnosticsManager(
    private val context: Context,
    private val supabaseClient: SupabaseClient,
    private val storageManager: StorageManager,
    private val coroutineScope: CoroutineScope,
    private val manifestVersionGetter: () -> String?,
    private val currentItemIdGetter: () -> String?
) {
    private val tag = "DiagnosticsManager"
    private var healthJob: Job? = null
    private var isRunning = false

    fun start() {
        if (isRunning) return
        isRunning = true
        Log.d(tag, "Starting DiagnosticsManager health reporting loop.")

        healthJob = coroutineScope.launch {
            while (isRunning) {
                // Report health every 5 minutes
                reportSingleHealth()
                delay(300000)
            }
        }
    }

    fun stop() {
        isRunning = false
        healthJob?.cancel()
        healthJob = null
        Log.d(tag, "DiagnosticsManager stopped.")
    }

    fun reportSingleHealth(lastError: String? = null) {
        val deviceId = storageManager.getDeviceId() ?: return
        val sessionToken = storageManager.getSessionToken() ?: return

        coroutineScope.launch(Dispatchers.IO) {
            try {
                val appVersion = getAppVersion()
                val osVersion = getOsVersion()
                val freeDiskBytes = getFreeDiskBytes()
                val memoryClassMb = getMemoryClassMb()
                val networkType = getNetworkType()
                val manifestVersion = manifestVersionGetter()
                val currentItemId = currentItemIdGetter()

                Log.d(tag, "Reporting device health: app=$appVersion, os=$osVersion, freeDisk=$freeDiskBytes, net=$networkType")
                supabaseClient.reportDeviceHealth(
                    deviceId = deviceId,
                    sessionToken = sessionToken,
                    appVersion = appVersion,
                    osVersion = osVersion,
                    freeDiskBytes = freeDiskBytes,
                    memoryClassMb = memoryClassMb,
                    networkType = networkType,
                    manifestVersion = manifestVersion,
                    currentItemId = currentItemId,
                    lastError = lastError
                )
            } catch (e: Exception) {
                Log.e(tag, "Failed to report device health: ${e.message}")
            }
        }
    }

    fun reportPlaybackEvent(
        eventType: String,
        itemId: String?,
        assetId: String?,
        positionMs: Long = 0,
        durationMs: Long = 0,
        cacheStatus: String? = null,
        errorMessage: String? = null
    ) {
        val deviceId = storageManager.getDeviceId() ?: return
        val sessionToken = storageManager.getSessionToken() ?: return

        coroutineScope.launch(Dispatchers.IO) {
            try {
                Log.d(tag, "Reporting playback event: type=$eventType, itemId=$itemId, assetId=$assetId")
                supabaseClient.reportPlaybackEvent(
                    deviceId = deviceId,
                    sessionToken = sessionToken,
                    eventType = eventType,
                    itemId = itemId,
                    assetId = assetId,
                    positionMs = positionMs,
                    durationMs = durationMs,
                    cacheStatus = cacheStatus,
                    errorMessage = errorMessage
                )
            } catch (e: Exception) {
                Log.e(tag, "Failed to report playback event: ${e.message}")
            }
        }
    }

    private fun getAppVersion(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    private fun getOsVersion(): String {
        return "Android ${android.os.Build.VERSION.RELEASE}"
    }

    private fun getFreeDiskBytes(): Long {
        return try {
            val stat = StatFs(context.filesDir.absolutePath)
            stat.availableBlocksLong * stat.blockSizeLong
        } catch (e: Exception) {
            0L
        }
    }

    private fun getMemoryClassMb(): Int {
        return try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            am.memoryClass
        } catch (e: Exception) {
            0
        }
    }

    private fun getNetworkType(): String {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val activeNetwork = cm.activeNetworkInfo
            activeNetwork?.typeName ?: "Offline"
        } catch (e: Exception) {
            "Unknown"
        }
    }
}
