package com.nuexis.player.cache

import android.content.Context
import android.util.Log
import com.nuexis.player.data.db.DownloadQueueEntry
import com.nuexis.player.data.db.PlayerDatabase
import com.nuexis.player.state.CacheStatus
import com.nuexis.player.state.PlayerStateHolder
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.coroutineContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import java.util.concurrent.TimeUnit
import kotlin.math.pow
import kotlin.random.Random

class DownloadQueue(
    private val context: Context,
    private val cacheStore: CacheStore,
    private val getSignedUrl: suspend (String) -> String
) {
    private val database = PlayerDatabase.getDatabase(context)
    private val dao = database.downloadQueueDao()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private var workerJob: Job? = null
    private val startMutex = Mutex()
    private var isQueuePaused = false

    fun enqueue(
        assetId: String,
        filePath: String,
        expectedSize: Long,
        expectedSha256: String,
        priority: Int
    ) {
        scope.launch {
            val existing = dao.getByAssetId(assetId)
            if (existing != null) {
                if (existing.status == "READY") {
                    Log.d("DownloadQueue", "Asset $assetId already downloaded and ready.")
                    return@launch
                }
                // Update priority or path
                dao.insert(existing.copy(
                    filePath = filePath,
                    expectedSize = expectedSize,
                    expectedSha256 = expectedSha256,
                    priority = priority,
                    status = "PENDING"
                ))
            } else {
                dao.insert(
                    DownloadQueueEntry(
                        assetId = assetId,
                        filePath = filePath,
                        expectedSize = expectedSize,
                        expectedSha256 = expectedSha256,
                        priority = priority,
                        status = "PENDING"
                    )
                )
            }
            startWorkerIfNeeded()
        }
    }

    fun startWorkerIfNeeded() {
        scope.launch {
            startMutex.withLock {
                if (workerJob == null || workerJob?.isCompleted == true) {
                    isQueuePaused = false
                    workerJob = scope.launch {
                        runQueueProcessor()
                    }
                }
            }
        }
    }

    fun stop() {
        workerJob?.cancel()
        workerJob = null
    }

    private suspend fun runQueueProcessor() {
        Log.d("DownloadQueue", "Starting download queue worker...")
        while (coroutineContext.isActive && !isQueuePaused) {
            val task = dao.getNextPending()
            if (task == null) {
                Log.d("DownloadQueue", "Queue is empty. Worker going idle.")
                updateOverallProgress(CacheStatus.READY)
                break
            }

            try {
                processTask(task)
            } catch (e: CancellationException) {
                Log.d("DownloadQueue", "Queue processing cancelled.")
                throw e
            } catch (e: Exception) {
                Log.e("DownloadQueue", "Unhandled error processing task ${task.id}", e)
                dao.update(task.copy(status = "FAILED", errorMessage = e.message, updatedAt = System.currentTimeMillis()))
            }
        }
    }

    private suspend fun processTask(task: DownloadQueueEntry) {
        Log.d("DownloadQueue", "Processing download task: ${task.filePath} (Asset: ${task.assetId})")
        dao.update(task.copy(status = "DOWNLOADING", updatedAt = System.currentTimeMillis()))
        updateOverallProgress(CacheStatus.DOWNLOADING, currentAssetId = task.assetId)

        // Check if file is already in archive pool to avoid re-downloading!
        val cachedInArchive = cacheStore.getFileFromArchivePool(task.expectedSha256, task.expectedSize)
        if (cachedInArchive != null) {
            Log.d("DownloadQueue", "Found asset in archive pool! Copying from archive instead of downloading.")
            val partFile = File(cacheStore.mediaStagedDir, "${task.expectedSha256}.part")
            try {
                cachedInArchive.copyTo(partFile, overwrite = true)
                if (IntegrityChecker.validate(partFile, task.expectedSize, task.expectedSha256)) {
                    val finalFile = File(cacheStore.mediaStagedDir, cacheStore.deriveKey(task.filePath))
                    if (partFile.renameTo(finalFile)) {
                        cacheStore.registerStagedAsset(
                            key = finalFile.name,
                            manifestVersion = "",
                            assetId = task.assetId,
                            mimeType = getMimeTypeFromPath(task.filePath),
                            sizeBytes = task.expectedSize,
                            sha256 = task.expectedSha256
                        )
                        dao.update(task.copy(status = "READY", bytesDownloaded = task.expectedSize, updatedAt = System.currentTimeMillis()))
                        return
                    }
                }
            } catch (e: Exception) {
                Log.e("DownloadQueue", "Failed to copy asset from archive", e)
            } finally {
                if (partFile.exists()) partFile.delete()
            }
        }

        // Standard download
        val key = cacheStore.deriveKey(task.filePath)
        val partFile = File(cacheStore.mediaStagedDir, "$key.part")
        var bytesDownloaded = 0L

        if (partFile.exists()) {
            bytesDownloaded = partFile.length()
            if (bytesDownloaded > task.expectedSize) {
                partFile.delete()
                bytesDownloaded = 0L
            }
        }

        val signedUrl = getSignedUrl(task.filePath)
        val requestBuilder = Request.Builder().url(signedUrl)
        if (bytesDownloaded > 0) {
            requestBuilder.addHeader("Range", "bytes=$bytesDownloaded-")
        }
        val request = requestBuilder.build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.code == 404) {
                    Log.e("DownloadQueue", "File not found: ${task.filePath}")
                    dao.update(task.copy(status = "FAILED", errorMessage = "404 Not Found", updatedAt = System.currentTimeMillis()))
                    return
                }

                if (!response.isSuccessful) {
                    throw IOException("Unexpected HTTP response: ${response.code}")
                }

                val body = response.body ?: throw IOException("Empty response body")
                val isPartial = response.code == 206
                
                if (!isPartial) {
                    partFile.delete()
                    bytesDownloaded = 0L
                }

                val totalBytes = body.contentLength() + bytesDownloaded
                
                // Storage space check
                val freeDisk = cacheStore.getFreeDiskSpace()
                if (freeDisk < (totalBytes - bytesDownloaded) + (20 * 1024 * 1024L)) {
                    Log.e("DownloadQueue", "Disk is full. Cannot download asset.")
                    isQueuePaused = true
                    dao.update(task.copy(status = "FAILED", errorMessage = "Disk space low", updatedAt = System.currentTimeMillis()))
                    updateOverallProgress(CacheStatus.DISK_FULL)
                    return
                }

                val inputStream = body.byteStream()
                val outputStream = if (isPartial) {
                    RandomAccessFile(partFile, "rw").apply { seek(bytesDownloaded) }
                } else {
                    FileOutputStream(partFile)
                }

                val buffer = ByteArray(8192)
                var bytesRead = inputStream.read(buffer)
                var lastProgressUpdate = System.currentTimeMillis()

                try {
                    while (bytesRead != -1 && coroutineContext.isActive) {
                        if (outputStream is RandomAccessFile) {
                            outputStream.write(buffer, 0, bytesRead)
                        } else if (outputStream is FileOutputStream) {
                            outputStream.write(buffer, 0, bytesRead)
                        }
                        bytesDownloaded += bytesRead

                        val now = System.currentTimeMillis()
                        if (now - lastProgressUpdate > 500L) {
                            lastProgressUpdate = now
                            dao.update(task.copy(bytesDownloaded = bytesDownloaded, updatedAt = now))
                            updateOverallProgress(CacheStatus.DOWNLOADING, currentAssetId = task.assetId)
                        }

                        bytesRead = inputStream.read(buffer)
                    }
                } finally {
                    try {
                        if (outputStream is RandomAccessFile) outputStream.close()
                        else if (outputStream is FileOutputStream) outputStream.close()
                    } catch (_: Exception) {}
                    try { inputStream.close() } catch (_: Exception) {}
                }

                if (!coroutineContext.isActive) return

                // Perform final validation
                dao.update(task.copy(status = "VALIDATING", bytesDownloaded = bytesDownloaded, updatedAt = System.currentTimeMillis()))
                updateOverallProgress(CacheStatus.VALIDATING, currentAssetId = task.assetId)

                if (IntegrityChecker.validate(partFile, task.expectedSize, task.expectedSha256)) {
                    val finalFile = File(cacheStore.mediaStagedDir, key)
                    if (partFile.renameTo(finalFile)) {
                        cacheStore.registerStagedAsset(
                            key = key,
                            manifestVersion = "",
                            assetId = task.assetId,
                            mimeType = getMimeTypeFromPath(task.filePath),
                            sizeBytes = task.expectedSize,
                            sha256 = task.expectedSha256
                        )
                        dao.update(task.copy(status = "READY", bytesDownloaded = task.expectedSize, updatedAt = System.currentTimeMillis()))
                        Log.d("DownloadQueue", "Successfully finished downloading asset ${task.assetId}")
                    } else {
                        throw IOException("Failed to rename part file to staged destination")
                    }
                } else {
                    partFile.delete()
                    throw IOException("File integrity check failed")
                }
            }
        } catch (e: IOException) {
            handleDownloadError(task, e)
        }
    }

    private fun getMimeTypeFromPath(path: String): String {
        val ext = path.substringAfterLast(".").lowercase()
        return when (ext) {
            "mp4", "mkv", "webm" -> "video/$ext"
            "jpg", "jpeg", "png", "gif", "webp" -> "image/$ext"
            else -> "application/octet-stream"
        }
    }

    private suspend fun handleDownloadError(task: DownloadQueueEntry, e: IOException) {
        val attempts = task.attemptCount + 1
        if (attempts >= 6) {
            Log.e("DownloadQueue", "Max retries exceeded for task ${task.id}: ${e.message}")
            dao.update(
                task.copy(
                    status = "FAILED",
                    attemptCount = attempts,
                    errorMessage = e.message,
                    updatedAt = System.currentTimeMillis()
                )
            )
        } else {
            val backoffSec = 2.0.pow(attempts).toLong() + Random.nextLong(0, 3)
            Log.w("DownloadQueue", "Transient error downloading task ${task.id}. Retrying in ${backoffSec}s. Error: ${e.message}")
            dao.update(
                task.copy(
                    status = "RETRYING",
                    attemptCount = attempts,
                    errorMessage = e.message,
                    updatedAt = System.currentTimeMillis()
                )
            )
            // Schedule retry
            scope.launch {
                delay(backoffSec * 1000L)
                startWorkerIfNeeded()
            }
        }
    }

    private suspend fun updateOverallProgress(status: CacheStatus, currentAssetId: String = "") {
        val totalExpected = dao.getTotalExpectedBytes() ?: 0L
        val totalDownloaded = dao.getTotalBytesDownloaded() ?: 0L
        val pendingCount = dao.getAllByStatus("PENDING").size + dao.getAllByStatus("RETRYING").size
        val downloadingCount = dao.getAllByStatus("DOWNLOADING").size
        val totalCount = pendingCount + downloadingCount + dao.getAllByStatus("READY").size

        val percent = if (totalExpected > 0) {
            ((totalDownloaded * 100) / totalExpected).toInt().coerceIn(0, 100)
        } else {
            0
        }

        withContext(Dispatchers.Main) {
            PlayerStateHolder.updateCacheProgress(
                total = totalCount,
                downloaded = totalCount - pendingCount - downloadingCount,
                remaining = pendingCount + downloadingCount,
                percent = percent,
                currentAssetName = currentAssetId,
                status = status
            )
        }
    }
}
