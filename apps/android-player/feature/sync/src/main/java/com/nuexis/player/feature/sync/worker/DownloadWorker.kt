package com.nuexis.player.feature.sync.worker

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.nuexis.player.core.domain.model.DownloadStatus
import com.nuexis.player.core.domain.repository.AssetRepository
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.network.di.DownloadClient
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

@HiltWorker
class DownloadWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted workerParams: WorkerParameters,
    private val assetDao: com.nuexis.player.core.database.dao.AssetDao,
    private val assetRepository: AssetRepository,
    private val deviceRepository: DeviceRepository,
    @DownloadClient private val okHttpClient: OkHttpClient
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val pendingAssets = assetDao.observePendingDownloads().first()
        if (pendingAssets.isEmpty()) return Result.success()

        val device = deviceRepository.observeLocalDeviceState().first() ?: return Result.retry()
        val secret = device.secret ?: return Result.retry()
        val hardwareId = deviceRepository.getHardwareId()

        var successCount = 0

        for (asset in pendingAssets) {
            if (asset.mimeType.startsWith("application/x-widget")) {
                assetRepository.updateAssetStatus(asset.id, DownloadStatus.COMPLETED, asset.filePath)
                successCount++
                continue
            }

            assetRepository.updateAssetStatus(asset.id, DownloadStatus.DOWNLOADING, null)

            try {
                val signedUrl = assetRepository.getSignedMediaUrl(
                    filePath = asset.filePath,
                    hardwareId = hardwareId,
                    secret = secret
                )

                val request = Request.Builder().url(signedUrl).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (!response.isSuccessful) {
                    throw Exception("Download HTTP ${response.code}")
                }

                val body = response.body ?: throw Exception("Empty response body")
                val outFile = File(context.filesDir, "assets/${asset.id}")
                outFile.parentFile?.mkdirs()
                body.byteStream().use { input ->
                    outFile.outputStream().use { output -> input.copyTo(output) }
                }

                assetRepository.updateAssetStatus(
                    asset.id,
                    DownloadStatus.COMPLETED,
                    outFile.absolutePath
                )
                successCount++
                Log.i(TAG, "Downloaded asset ${asset.id}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to download asset ${asset.id}", e)
                assetRepository.updateAssetStatus(asset.id, DownloadStatus.FAILED, null)
            }
        }

        return if (successCount > 0) Result.success() else Result.retry()
    }

    companion object {
        private const val TAG = "DownloadWorker"
    }
}
