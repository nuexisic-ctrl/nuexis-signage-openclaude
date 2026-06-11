package com.nuexis.player.app.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlayerWorkScheduler @Inject constructor(
    @ApplicationContext private val context: Context
) {
    fun schedule() = schedule(context)

    fun cacheAsset(url: String, cacheKey: String, mimeType: String) {
        val request = OneTimeWorkRequestBuilder<AssetCacheWorker>()
            .setInputData(
                Data.Builder()
                    .putString(AssetCacheWorker.KEY_URL, url)
                    .putString(AssetCacheWorker.KEY_CACHE_KEY, cacheKey)
                    .putString(AssetCacheWorker.KEY_MIME_TYPE, mimeType)
                    .build()
            )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "cache-${cacheKey.hashCode()}",
            ExistingWorkPolicy.KEEP,
            request
        )
    }

    companion object {
        fun schedule(context: Context) {
            val watchdog = PeriodicWorkRequestBuilder<WatchdogWorker>(
                15,
                TimeUnit.MINUTES
            ).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "nuexis-player-watchdog",
                ExistingPeriodicWorkPolicy.UPDATE,
                watchdog
            )
        }
    }
}
