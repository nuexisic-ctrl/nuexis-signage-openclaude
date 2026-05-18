package com.nuexis.player.system

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints
import com.nuexis.player.BuildConfig
import com.nuexis.player.data.HealthEventRequest
import com.nuexis.player.network.SupabaseGateway
import com.nuexis.player.utils.SecureStorage
import java.util.concurrent.TimeUnit

class HealthHeartbeatWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val deviceId = SecureStorage.getDeviceId(applicationContext) ?: return Result.success()
        val token = SecureStorage.getSessionToken(applicationContext) ?: return Result.success()
        return runCatching {
            SupabaseGateway().reportHealth(
                HealthEventRequest(
                    deviceId = deviceId,
                    sessionToken = token,
                    appVersion = BuildConfig.VERSION_NAME,
                    osVersion = "Android ${Build.VERSION.RELEASE}",
                    freeDiskBytes = applicationContext.filesDir.freeSpace,
                    memoryClassMb = (applicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).memoryClass,
                    networkType = networkType(applicationContext)
                )
            )
            Result.success()
        }.getOrElse { Result.retry() }
    }

    private fun networkType(context: Context): String {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return "offline"
        val caps = cm.getNetworkCapabilities(network) ?: return "unknown"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            else -> "other"
        }
    }
}

object PlayerWorkScheduler {
    fun schedule(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = PeriodicWorkRequestBuilder<HealthHeartbeatWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "nuexis-health-heartbeat",
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }
}
