package com.nuexis.player.playback

import android.content.Context
import android.util.Log
import com.nuexis.player.cache.CacheStore
import com.nuexis.player.cache.IntegrityChecker
import com.nuexis.player.data.SupabaseClient
import com.nuexis.player.data.db.CacheEntry
import com.nuexis.player.data.db.PlayerDatabase
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit

@Deprecated("Use CacheStore and DownloadQueue instead", ReplaceWith("CacheStore"))
class CacheManager(
    private val context: Context,
    private val supabaseClient: SupabaseClient
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val cacheStore = CacheStore(context)
    private val database = PlayerDatabase.getDatabase(context)
    private val dao = database.cacheEntryDao()

    fun getCachedFile(filePath: String): File {
        val key = cacheStore.deriveKey(filePath)
        // Check if live exists, otherwise staged or archive, default to live
        val liveFile = cacheStore.getFileForGeneration(key, "live")
        if (liveFile.exists()) return liveFile
        val stagedFile = cacheStore.getFileForGeneration(key, "staged")
        if (stagedFile.exists()) return stagedFile
        val archiveFile = cacheStore.getFileForGeneration(key, "archive")
        if (archiveFile.exists()) return archiveFile
        return liveFile
    }

    fun isCached(filePath: String): Boolean {
        if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
            return false
        }
        val file = getCachedFile(filePath)
        return file.exists() && file.length() > 0
    }

    @Throws(IOException::class)
    fun downloadAsset(filePath: String, hardwareId: String, secret: String, onProgress: (Int) -> Unit = {}): File {
        val key = cacheStore.deriveKey(filePath)
        val file = cacheStore.getFileForGeneration(key, "live")
        
        if (file.exists() && file.length() > 0) {
            return file
        }

        val signedUrl = if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
            filePath
        } else {
            supabaseClient.getSignedMediaUrl(filePath, hardwareId, secret)
        }

        val request = Request.Builder().url(signedUrl).build()
        val tempFile = File(cacheStore.mediaLiveDir, "$key.tmp")

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Failed to download file: ${response.code}")
            }
            val body = response.body ?: throw IOException("Empty response body")
            val totalBytes = body.contentLength()
            var bytesCopied = 0L

            body.byteStream().use { input ->
                FileOutputStream(tempFile).use { output ->
                    val buffer = ByteArray(8192)
                    var bytes = input.read(buffer)
                    while (bytes >= 0) {
                        output.write(buffer, 0, bytes)
                        bytesCopied += bytes
                        if (totalBytes > 0) {
                            onProgress(((bytesCopied * 100) / totalBytes).toInt())
                        }
                        bytes = input.read(buffer)
                    }
                }
            }
        }

        if (tempFile.renameTo(file)) {
            // Register in database
            val sha256 = IntegrityChecker.calculateSha256(file) ?: ""
            val entry = CacheEntry(
                key = key,
                manifestVersion = "",
                assetId = "",
                mimeType = getMimeTypeFromPath(filePath),
                sizeBytes = file.length(),
                sha256 = sha256,
                status = "live",
                bytesDownloaded = file.length(),
                generation = "live",
                createdAt = System.currentTimeMillis(),
                lastUsedAt = System.currentTimeMillis()
            )
            runBlocking {
                dao.insertOrUpdate(entry)
            }
            return file
        } else {
            tempFile.delete()
            throw IOException("Failed to rename temporary download file")
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

    fun evictStaleFiles(activePaths: Set<String>) {
        val activeKeys = activePaths.map { cacheStore.deriveKey(it) }.toSet()
        runBlocking {
            val liveEntries = dao.getByGeneration("live")
            for (entry in liveEntries) {
                if (!activeKeys.contains(entry.key)) {
                    val file = cacheStore.getFileForGeneration(entry.key, "live")
                    if (file.exists()) {
                        file.delete()
                    }
                    dao.delete(entry)
                }
            }
        }
    }
}

