package com.nuexis.player.cache

import android.content.Context
import android.os.StatFs
import android.util.Log
import com.nuexis.player.data.db.CacheEntry
import com.nuexis.player.data.db.PlayerDatabase
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CacheStore(private val context: Context) {
    private val database = PlayerDatabase.getDatabase(context)
    private val dao = database.cacheEntryDao()

    val rootDir = File(context.filesDir, "nuexis_player")
    val mediaLiveDir = File(rootDir, "media/live")
    val mediaStagedDir = File(rootDir, "media/staged")
    val mediaArchiveDir = File(rootDir, "media/archive")
    val manifestsDir = File(rootDir, "manifests")

    init {
        createDirectories()
    }

    private fun createDirectories() {
        if (!mediaLiveDir.exists()) mediaLiveDir.mkdirs()
        if (!mediaStagedDir.exists()) mediaStagedDir.mkdirs()
        if (!mediaArchiveDir.exists()) mediaArchiveDir.mkdirs()
        if (!manifestsDir.exists()) manifestsDir.mkdirs()
    }

    fun deriveKey(filePath: String): String {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            val hashBytes = digest.digest(filePath.toByteArray())
            hashBytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            // Fallback safe string representation
            filePath.hashCode().toString()
        }
    }

    suspend fun getCachedFile(key: String, expectedSha256: String, expectedSize: Long): File? = withContext(Dispatchers.IO) {
        val entry = dao.getByKey(key) ?: return@withContext null
        val file = getFileForGeneration(key, entry.generation)
        
        if (file.exists() && IntegrityChecker.validate(file, expectedSize, expectedSha256)) {
            // Update last used timestamp
            val updatedEntry = entry.copy(lastUsedAt = System.currentTimeMillis())
            dao.insertOrUpdate(updatedEntry)
            return@withContext file
        } else {
            // File is missing or corrupted, remove index entry
            dao.deleteByKey(key)
            if (file.exists()) file.delete()
            return@withContext null
        }
    }

    fun getFileForGeneration(key: String, generation: String): File {
        return when (generation.lowercase()) {
            "live" -> File(mediaLiveDir, key)
            "staged" -> File(mediaStagedDir, key)
            "archive" -> File(mediaArchiveDir, key)
            else -> File(mediaArchiveDir, key)
        }
    }

    suspend fun registerStagedAsset(
        key: String,
        manifestVersion: String,
        assetId: String,
        mimeType: String,
        sizeBytes: Long,
        sha256: String
    ) = withContext(Dispatchers.IO) {
        val entry = CacheEntry(
            key = key,
            manifestVersion = manifestVersion,
            assetId = assetId,
            mimeType = mimeType,
            sizeBytes = sizeBytes,
            sha256 = sha256,
            status = "staged",
            bytesDownloaded = sizeBytes,
            generation = "staged",
            createdAt = System.currentTimeMillis(),
            lastUsedAt = System.currentTimeMillis()
        )
        dao.insertOrUpdate(entry)
    }

    suspend fun promoteStaged(manifestVersion: String, activeKeys: Set<String>) = withContext(Dispatchers.IO) {
        Log.d("CacheStore", "Promoting staged assets for manifest version: $manifestVersion")
        
        // 1. Move old live files that are not active anymore to archive
        val oldLiveEntries = dao.getByGeneration("live")
        for (entry in oldLiveEntries) {
            if (!activeKeys.contains(entry.key)) {
                val liveFile = getFileForGeneration(entry.key, "live")
                val archiveFile = getFileForGeneration(entry.key, "archive")
                
                if (liveFile.exists()) {
                    if (liveFile.renameTo(archiveFile)) {
                        dao.insertOrUpdate(entry.copy(generation = "archive", status = "archive"))
                    } else {
                        Log.e("CacheStore", "Failed to move live asset to archive: ${entry.key}")
                    }
                }
            }
        }

        // 2. Move staged files that are active to live
        val stagedEntries = dao.getByGeneration("staged")
        for (entry in stagedEntries) {
            if (activeKeys.contains(entry.key)) {
                val stagedFile = getFileForGeneration(entry.key, "staged")
                val liveFile = getFileForGeneration(entry.key, "live")
                
                if (stagedFile.exists()) {
                    if (stagedFile.renameTo(liveFile)) {
                        dao.insertOrUpdate(entry.copy(generation = "live", status = "live", manifestVersion = manifestVersion))
                    } else {
                        Log.e("CacheStore", "Failed to move staged asset to live: ${entry.key}")
                    }
                }
            }
        }

        // 3. Clean up any remaining staged files that are not needed
        val remainingStaged = dao.getByGeneration("staged")
        for (entry in remainingStaged) {
            val stagedFile = getFileForGeneration(entry.key, "staged")
            if (stagedFile.exists()) stagedFile.delete()
            dao.delete(entry)
        }

        // 4. Run eviction under storage pressure
        evictIfNeeded()
    }

    suspend fun evictIfNeeded() = withContext(Dispatchers.IO) {
        val freeSpace = getFreeDiskSpace()
        val threshold = 100 * 1024 * 1024L // 100MB floor
        
        if (freeSpace < threshold) {
            Log.w("CacheStore", "Low disk space ($freeSpace bytes free). Running eviction...")
            
            // Evict archive entries starting from oldest used
            val archiveEntries = dao.getByGeneration("archive")
                .sortedBy { it.lastUsedAt }
            
            var spaceNeeded = threshold - freeSpace
            for (entry in archiveEntries) {
                if (spaceNeeded <= 0) break
                
                val file = getFileForGeneration(entry.key, "archive")
                val fileSize = file.length()
                if (file.exists()) {
                    if (file.delete()) {
                        spaceNeeded -= fileSize
                        dao.delete(entry)
                        Log.d("CacheStore", "Evicted archive asset: ${entry.key}")
                    }
                } else {
                    dao.delete(entry)
                }
            }
        }
    }

    fun getFreeDiskSpace(): Long {
        val stats = StatFs(context.filesDir.absolutePath)
        return stats.availableBlocksLong * stats.blockSizeLong
    }

    suspend fun migrateLegacyCache() = withContext(Dispatchers.IO) {
        val legacyDir = File(context.filesDir, "media")
        if (!legacyDir.exists() || !legacyDir.isDirectory) return@withContext

        Log.d("CacheStore", "Scanning legacy cache for files to adopt...")
        val files = legacyDir.listFiles() ?: return@withContext
        for (file in files) {
            if (file.isFile && !file.name.endsWith(".tmp") && !file.name.endsWith(".part")) {
                // If it's a valid legacy file, calculate its size and SHA-256
                val size = file.length()
                if (size <= 0) {
                    file.delete()
                    continue
                }
                
                val sha256 = IntegrityChecker.calculateSha256(file) ?: continue
                
                // Let's copy this file to the archive directory as a pool of available files
                val archiveFile = File(mediaArchiveDir, sha256)
                if (!archiveFile.exists()) {
                    try {
                        file.copyTo(archiveFile, overwrite = true)
                        Log.d("CacheStore", "Adopted legacy file ${file.name} to archive as $sha256")
                    } catch (e: Exception) {
                        Log.e("CacheStore", "Failed to adopt legacy file: ${file.name}", e)
                    }
                }
                // Delete legacy file to free space
                file.delete()
            }
        }
        
        // Remove legacy directory if empty
        if (legacyDir.listFiles()?.isEmpty() == true) {
            legacyDir.delete()
        }
    }

    suspend fun getFileFromArchivePool(sha256: String, expectedSize: Long): File? = withContext(Dispatchers.IO) {
        val archiveFile = File(mediaArchiveDir, sha256)
        if (archiveFile.exists() && archiveFile.length() == expectedSize) {
            if (IntegrityChecker.validate(archiveFile, expectedSize, sha256)) {
                return@withContext archiveFile
            }
        }
        return@withContext null
    }
}
