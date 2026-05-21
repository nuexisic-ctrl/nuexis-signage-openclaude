package com.nuexis.player.feature.sync.realtime

import android.util.Log
import com.nuexis.player.core.domain.realtime.RealtimeSyncTrigger
import com.nuexis.player.core.domain.repository.SyncRepository
import com.nuexis.player.core.domain.sync.SyncWorkScheduler
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RealtimeSyncTriggerImpl @Inject constructor(
    private val syncRepository: SyncRepository,
    private val syncWorkScheduler: SyncWorkScheduler
) : RealtimeSyncTrigger {

    override suspend fun onSyncRequested(reason: String) {
        Log.d(TAG, "Sync requested: $reason")
        syncRepository.syncDeviceState()
        syncWorkScheduler.enqueueDownload()
    }

    override suspend fun onDeviceUnpaired() {
        Log.i(TAG, "Device unpaired — stopping background work")
        syncWorkScheduler.cancelPeriodicWorkers()
    }

    companion object {
        private const val TAG = "RealtimeSyncTrigger"
    }
}
