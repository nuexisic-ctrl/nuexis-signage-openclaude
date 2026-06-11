package com.nuexis.player.feature.sync.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.nuexis.player.core.domain.sync.SyncWorkScheduler
import com.nuexis.player.feature.sync.worker.DownloadWorker
import com.nuexis.player.feature.sync.worker.HeartbeatWorker
import com.nuexis.player.feature.sync.worker.SyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncWorkSchedulerImpl @Inject constructor(
    @ApplicationContext private val context: Context
) : SyncWorkScheduler {

    private val workManager = WorkManager.getInstance(context)

    override fun syncOnce() {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(connectedConstraints())
            .build()
        workManager.enqueueUniqueWork(
            SYNC_ONCE_WORK,
            androidx.work.ExistingWorkPolicy.REPLACE,
            request
        )
    }

    override fun enqueueDownload() {
        val request = OneTimeWorkRequestBuilder<DownloadWorker>()
            .setConstraints(connectedConstraints())
            .build()
        workManager.enqueueUniqueWork(
            DOWNLOAD_WORK,
            androidx.work.ExistingWorkPolicy.REPLACE,
            request
        )
    }

    override fun schedulePeriodicWorkers() {
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(5, TimeUnit.MINUTES)
            .setConstraints(connectedConstraints())
            .build()
        workManager.enqueueUniquePeriodicWork(
            SYNC_PERIODIC_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )

        val heartbeatRequest = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
            .setConstraints(connectedConstraints())
            .build()
        workManager.enqueueUniquePeriodicWork(
            HEARTBEAT_PERIODIC_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            heartbeatRequest
        )
    }

    override fun cancelPeriodicWorkers() {
        workManager.cancelUniqueWork(SYNC_PERIODIC_WORK)
        workManager.cancelUniqueWork(HEARTBEAT_PERIODIC_WORK)
        workManager.cancelUniqueWork(DOWNLOAD_WORK)
    }

    private fun connectedConstraints(): Constraints =
        Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

    companion object {
        const val SYNC_PERIODIC_WORK = "nuexis_sync_periodic"
        const val HEARTBEAT_PERIODIC_WORK = "nuexis_heartbeat_periodic"
        const val DOWNLOAD_WORK = "nuexis_download_once"
        const val SYNC_ONCE_WORK = "nuexis_sync_once"
    }
}
