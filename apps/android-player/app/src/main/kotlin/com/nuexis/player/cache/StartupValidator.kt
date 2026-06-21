package com.nuexis.player.cache

import android.content.Context
import android.util.Log
import com.nuexis.player.data.db.PlayerDatabase
import com.nuexis.player.data.StorageManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class StartupValidator(
    private val context: Context,
    private val cacheStore: CacheStore,
    private val storageManager: StorageManager,
    private val downloadQueue: DownloadQueue
) {
    private val database = PlayerDatabase.getDatabase(context)
    private val cacheDao = database.cacheEntryDao()
    private val queueDao = database.downloadQueueDao()

    suspend fun validateAtStartup() = withContext(Dispatchers.IO) {
        Log.d("StartupValidator", "Starting boot-time cache validation...")
        
        // 1. Migrate legacy cache if exists
        cacheStore.migrateLegacyCache()

        // 2. Clean up temporary .tmp and .part files older than 1 hour
        cleanOldPartFiles(cacheStore.mediaLiveDir)
        cleanOldPartFiles(cacheStore.mediaStagedDir)
        cleanOldPartFiles(cacheStore.mediaArchiveDir)

        // 3. Reconcile DB CacheEntries vs Filesystem
        val allLiveEntries = cacheDao.getByGeneration("live")
        for (entry in allLiveEntries) {
            val file = cacheStore.getFileForGeneration(entry.key, "live")
            if (!file.exists()) {
                Log.w("StartupValidator", "Index entry for live asset ${entry.key} exists but file is missing. Deleting entry.")
                cacheDao.delete(entry)
            } else if (file.length() != entry.sizeBytes) {
                Log.w("StartupValidator", "Size mismatch for live asset ${entry.key}. Deleting file and entry.")
                file.delete()
                cacheDao.delete(entry)
            }
        }

        // 4. Remove orphan files in media/live/ that are not in Room DB
        val dbKeys = allLiveEntries.map { it.key }.toSet()
        val files = cacheStore.mediaLiveDir.listFiles() ?: emptyArray()
        for (file in files) {
            if (file.isFile && !dbKeys.contains(file.name)) {
                Log.w("StartupValidator", "Orphan file in live directory: ${file.name}. Deleting.")
                file.delete()
            }
        }

        // 5. Clean completed items from DownloadQueue
        queueDao.deleteCompleted()

        // 6. Resume any incomplete downloads
        val pendingDownloads = queueDao.getAllByStatus("PENDING") + queueDao.getAllByStatus("RETRYING") + queueDao.getAllByStatus("DOWNLOADING")
        if (pendingDownloads.isNotEmpty()) {
            Log.d("StartupValidator", "Found ${pendingDownloads.size} incomplete downloads. Resuming download queue.")
            downloadQueue.startWorkerIfNeeded()
        }
        
        Log.d("StartupValidator", "Boot-time cache validation finished.")
    }

    private fun cleanOldPartFiles(directory: File) {
        val files = directory.listFiles() ?: return
        val oneHourAgo = System.currentTimeMillis() - 3600 * 1000L
        for (file in files) {
            if (file.isFile && (file.name.endsWith(".tmp") || file.name.endsWith(".part"))) {
                if (file.lastModified() < oneHourAgo) {
                    Log.d("StartupValidator", "Deleting old part/tmp file: ${file.name}")
                    file.delete()
                }
            }
        }
    }
}
