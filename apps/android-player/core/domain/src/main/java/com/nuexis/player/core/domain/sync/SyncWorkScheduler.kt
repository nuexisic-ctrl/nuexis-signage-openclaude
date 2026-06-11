package com.nuexis.player.core.domain.sync

interface SyncWorkScheduler {
    fun syncOnce()
    fun enqueueDownload()
    fun schedulePeriodicWorkers()
    fun cancelPeriodicWorkers()
}
