package com.nuexis.player.app.work

import android.app.ActivityManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.nuexis.player.app.MainActivity
import com.nuexis.player.app.diagnostics.StructuredLogger
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class WatchdogWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val logger: StructuredLogger
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val preferences = applicationContext.getSharedPreferences(
            HEALTH_PREFERENCES,
            Context.MODE_PRIVATE
        )
        val lastHealthyAt = preferences.getLong(KEY_LAST_HEALTHY_AT, 0)
        val stale = lastHealthyAt > 0 &&
            System.currentTimeMillis() - lastHealthyAt > STALE_AFTER_MS
        if (stale && !isAppInForeground()) {
            logger.warn("watchdog_restart_requested")
            PendingIntent.getActivity(
                applicationContext,
                9402,
                Intent(applicationContext, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            ).send()
        }
        return Result.success()
    }

    private fun isAppInForeground(): Boolean {
        val manager = applicationContext.getSystemService(ActivityManager::class.java)
        return manager.runningAppProcesses.orEmpty().any {
            it.processName == applicationContext.packageName &&
                it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        }
    }

    companion object {
        const val HEALTH_PREFERENCES = "nuexis_health"
        const val KEY_LAST_HEALTHY_AT = "last_healthy_at"
        private const val STALE_AFTER_MS = 20L * 60 * 1000
    }
}
