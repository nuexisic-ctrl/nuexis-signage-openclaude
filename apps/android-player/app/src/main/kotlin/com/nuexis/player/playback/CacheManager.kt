package com.nuexis.player.playback

import android.content.Context
import com.nuexis.player.data.SupabaseClient
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

class CacheManager(
    private val context: Context,
    private val supabaseClient: SupabaseClient
) {
    private val client = OkHttpClient()
    private val mediaDir = File(context.filesDir, "media").apply {
        if (!exists()) {
            mkdirs()
        }
    }

    private fun getSanitizedFilename(filePath: String): String {
        return try {
            val bytes = MessageDigest.getInstance("MD5").digest(filePath.toByteArray())
            val hash = bytes.joinToString("") { "%02x".format(it) }
            val name = filePath.substringAfterLast("/").replace("[^a-zA-Z0-9._-]".toRegex(), "_")
            "${hash}_${name}"
        } catch (e: Exception) {
            filePath.replace("/", "_").replace("\\", "_").replace(":", "_")
        }
    }

    fun getCachedFile(filePath: String): File {
        return File(mediaDir, getSanitizedFilename(filePath))
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
        val file = getCachedFile(filePath)
        
        if (file.exists() && file.length() > 0) {
            return file
        }

        val signedUrl = if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
            filePath
        } else {
            supabaseClient.getSignedMediaUrl(filePath, hardwareId, secret)
        }

        val request = Request.Builder().url(signedUrl).build()
        val tempFile = File(mediaDir, file.name + ".tmp")

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
            return file
        } else {
            tempFile.delete()
            throw IOException("Failed to rename temporary download file")
        }
    }

    fun evictStaleFiles(activePaths: Set<String>) {
        val activeFilenames = activePaths.map { getSanitizedFilename(it) }.toSet()
        val cachedFiles = mediaDir.listFiles() ?: return
        for (file in cachedFiles) {
            if (file.isFile && !activeFilenames.contains(file.name) && !file.name.endsWith(".tmp")) {
                file.delete()
            }
        }
    }
}
