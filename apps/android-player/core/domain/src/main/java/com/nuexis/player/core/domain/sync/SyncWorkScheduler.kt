package com.nuexis.player.core.domain.sync

interface SyncWorkScheduler {
    fun enqueueDownload()
    fun schedulePeriodicWorkers()
    fun cancelPeriodicWorkers()
}
