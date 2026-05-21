package com.nuexis.player.feature.sync.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.nuexis.player.core.domain.repository.DeviceRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first

@HiltWorker
class HeartbeatWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val deviceRepository: DeviceRepository
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val device = deviceRepository.observeLocalDeviceState().first()
            if (device != null && device.secret != null) {
                // Batch increment playtime since last heartbeat (e.g., 15 minutes)
                deviceRepository.incrementPlaytime(
                    deviceId = device.id,
                    hardwareId = deviceRepository.getHardwareId(),
                    secret = device.secret!!,
                    seconds = 15 * 60
                )
            }
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
