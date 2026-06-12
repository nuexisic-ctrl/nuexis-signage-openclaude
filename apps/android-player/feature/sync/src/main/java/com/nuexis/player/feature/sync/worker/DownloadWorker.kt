package com.nuexis.player.feature.sync.worker

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.nuexis.player.core.domain.model.DownloadStatus
import com.nuexis.player.core.domain.repository.AssetRepository
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.domain.sync.AssetSyncDiagnosticsManager
import com.nuexis.player.core.domain.sync.AssetDiagnostic
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
    private val diagnosticsManager: AssetSyncDiagnosticsManager,
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
            // Widget type assets bypass direct file download
            if (asset.mimeType.startsWith("application/x-widget")) {
                assetRepository.updateAssetStatus(asset.id, DownloadStatus.COMPLETED, asset.filePath)
                diagnosticsManager.updateDiagnostic(asset.id) {
                    AssetDiagnostic(
                        id = asset.id,
                        fileName = asset.filePath.substringAfterLast("/"),
                        filePath = asset.filePath,
                        mimeType = asset.mimeType,
                        sizeBytes = asset.sizeBytes,
                        status = DownloadStatus.COMPLETED,
                        localUri = asset.filePath,
                        retryCount = runAttemptCount
                    )
                }
                successCount++
                continue
            }

            // Set to downloading status
            assetRepository.updateAssetStatus(asset.id, DownloadStatus.DOWNLOADING, null)
            diagnosticsManager.updateDiagnostic(asset.id) { existing ->
                existing?.copy(status = DownloadStatus.DOWNLOADING) ?: AssetDiagnostic(
                    id = asset.id,
                    fileName = asset.filePath.substringAfterLast("/"),
                    filePath = asset.filePath,
                    mimeType = asset.mimeType,
                    sizeBytes = asset.sizeBytes,
                    status = DownloadStatus.DOWNLOADING,
                    localUri = null,
                    retryCount = runAttemptCount
                )
            }

            val startTime = System.currentTimeMillis()
            var httpStatus = 0
            var finalUrl: String? = null
            var responseHeaders: String? = null

            try {
                // Validation: Filepath validation
                if (asset.filePath.isBlank()) {
                    throw IllegalArgumentException("Empty file path for asset ${asset.id}")
                }
                val sanitizedPath = asset.filePath.replace("//", "/")

                // Construct Next.js download URL
                val playerBaseUrl = com.nuexis.player.core.network.BuildConfig.PLAYER_URL
                    .removeSuffix("/player")
                    .removeSuffix("/")
                val downloadUrl = "$playerBaseUrl/api/public/assets/${asset.id}"
                finalUrl = downloadUrl

                val outFile = File(context.filesDir, "assets/${asset.id}")

                // Pre-check: Check if file already exists with same size
                if (outFile.exists() && asset.sizeBytes > 0 && outFile.length() == asset.sizeBytes) {
                    Log.i(TAG, "Asset ${asset.id} already exists locally with correct size. Skipping download.")
                    assetRepository.updateAssetStatus(asset.id, DownloadStatus.COMPLETED, outFile.absolutePath)
                    
                    diagnosticsManager.updateDiagnostic(asset.id) { existing ->
                        existing?.copy(
                            status = DownloadStatus.COMPLETED,
                            localUri = outFile.absolutePath,
                            url = downloadUrl,
                            httpStatus = 200,
                            lastError = null
                        ) ?: AssetDiagnostic(
                            id = asset.id,
                            fileName = asset.filePath.substringAfterLast("/"),
                            filePath = asset.filePath,
                            mimeType = asset.mimeType,
                            sizeBytes = asset.sizeBytes,
                            status = DownloadStatus.COMPLETED,
                            localUri = outFile.absolutePath,
                            url = downloadUrl,
                            httpStatus = 200
                        )
                    }
                    successCount++
                    continue
                }

                // Check directory permissions
                outFile.parentFile?.mkdirs()
                if (outFile.parentFile?.canWrite() != true) {
                    throw Exception("No write permission for directory ${outFile.parentFile?.absolutePath}")
                }

                val request = Request.Builder().url(downloadUrl).get().build()
                val response = okHttpClient.newCall(request).execute()
                httpStatus = response.code
                finalUrl = response.request.url.toString()
                responseHeaders = response.headers.toString()

                if (!response.isSuccessful) {
                    throw Exception("Download HTTP $httpStatus: ${response.message}")
                }

                val body = response.body ?: throw Exception("Empty response body")
                val contentLength = body.contentLength()
                val expectedSize = if (contentLength > 0) contentLength else asset.sizeBytes

                // Stream copy with time calculation
                body.byteStream().use { input ->
                    outFile.outputStream().use { output -> input.copyTo(output) }
                }

                val endTime = System.currentTimeMillis()
                val durationMs = endTime - startTime
                val fileSize = outFile.length()

                // Validation: check for empty or size mismatch (corrupted download)
                if (fileSize == 0L) {
                    outFile.delete()
                    throw Exception("Downloaded file is empty (0 bytes)")
                }
                if (expectedSize > 0 && fileSize != expectedSize) {
                    outFile.delete()
                    throw Exception("File size mismatch. Expected: $expectedSize, Got: $fileSize")
                }

                // Calculate speed in Kbps
                val speedKbps = if (durationMs > 0) (fileSize * 8.0) / durationMs else 0.0

                // Mark COMPLETED in Room DB
                assetRepository.updateAssetStatus(asset.id, DownloadStatus.COMPLETED, outFile.absolutePath)
                successCount++

                diagnosticsManager.updateDiagnostic(asset.id) { existing ->
                    existing?.copy(
                        status = DownloadStatus.COMPLETED,
                        localUri = outFile.absolutePath,
                        downloadDurationMs = durationMs,
                        downloadSpeedKbps = speedKbps,
                        url = finalUrl,
                        httpStatus = httpStatus,
                        lastError = null
                    ) ?: AssetDiagnostic(
                        id = asset.id,
                        fileName = asset.filePath.substringAfterLast("/"),
                        filePath = asset.filePath,
                        mimeType = asset.mimeType,
                        sizeBytes = fileSize,
                        status = DownloadStatus.COMPLETED,
                        localUri = outFile.absolutePath,
                        downloadDurationMs = durationMs,
                        downloadSpeedKbps = speedKbps,
                        url = finalUrl,
                        httpStatus = httpStatus
                    )
                }

                Log.i(TAG, "Downloaded asset ${asset.id} in ${durationMs}ms at ${String.format("%.2f", speedKbps)} Kbps. Headers: $responseHeaders")
            } catch (e: Exception) {
                val errorDetails = Log.getStackTraceString(e)
                Log.e(TAG, "Failed to download asset ${asset.id}. URL: $finalUrl, HTTP: $httpStatus", e)

                // Delete potentially partial or corrupted files
                val outFile = File(context.filesDir, "assets/${asset.id}")
                if (outFile.exists()) {
                    outFile.delete()
                }

                if (runAttemptCount < 3) {
                    // Update diagnostics with current failure details but keep status as PENDING (for retry)
                    diagnosticsManager.updateDiagnostic(asset.id) { existing ->
                        existing?.copy(
                            status = DownloadStatus.PENDING,
                            lastError = e.message ?: "Attempt $runAttemptCount failed",
                            url = finalUrl,
                            httpStatus = httpStatus,
                            retryCount = runAttemptCount
                        ) ?: AssetDiagnostic(
                            id = asset.id,
                            fileName = asset.filePath.substringAfterLast("/"),
                            filePath = asset.filePath,
                            mimeType = asset.mimeType,
                            sizeBytes = asset.sizeBytes,
                            status = DownloadStatus.PENDING,
                            localUri = null,
                            lastError = e.message,
                            url = finalUrl,
                            httpStatus = httpStatus,
                            retryCount = runAttemptCount
                        )
                    }
                } else {
                    // Maximum retry attempts reached. Set status to FAILED.
                    assetRepository.updateAssetStatus(asset.id, DownloadStatus.FAILED, null)
                    diagnosticsManager.updateDiagnostic(asset.id) { existing ->
                        existing?.copy(
                            status = DownloadStatus.FAILED,
                            lastError = errorDetails,
                            url = finalUrl,
                            httpStatus = httpStatus,
                            retryCount = runAttemptCount
                        ) ?: AssetDiagnostic(
                            id = asset.id,
                            fileName = asset.filePath.substringAfterLast("/"),
                            filePath = asset.filePath,
                            mimeType = asset.mimeType,
                            sizeBytes = asset.sizeBytes,
                            status = DownloadStatus.FAILED,
                            localUri = null,
                            lastError = errorDetails,
                            url = finalUrl,
                            httpStatus = httpStatus,
                            retryCount = runAttemptCount
                        )
                    }
                }
            }
        }

        // Return retry if there are still pending downloads in the DB
        val hasFailedOrPending = assetDao.observePendingDownloads().first().isNotEmpty()
        return if (hasFailedOrPending) {
            Result.retry()
        } else {
            Result.success()
        }
    }

    companion object {
        private const val TAG = "DownloadWorker"
    }
}
