package com.nuexis.player.cache

import android.content.Context
import com.nuexis.player.data.ManifestItem
import com.nuexis.player.network.SupabaseGateway
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsChannel
import io.ktor.utils.io.readAvailable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

class MediaCacheManager(
    context: Context,
    private val gateway: SupabaseGateway,
    private val httpClient: HttpClient = SupabaseGateway.defaultHttpClient()
) {
    private val cacheDir = File(context.filesDir, "media-cache").apply { mkdirs() }
    private val maxCacheBytes = 4L * 1024L * 1024L * 1024L

    suspend fun resolvePlayableUri(deviceId: String, sessionToken: String, item: ManifestItem): CacheResult {
        val asset = item.asset ?: return CacheResult.Remote("", "missing")
        if (asset.filePath.startsWith("http://") || asset.filePath.startsWith("https://")) {
            return CacheResult.Remote(asset.filePath, "remote")
        }
        val file = cacheFile(asset.filePath)
        if (file.exists() && (asset.sizeBytes <= 0 || file.length() == asset.sizeBytes)) {
            return CacheResult.Local(file, "hit")
        }
        val signedUrl = asset.signedUrl ?: gateway.getSignedMediaUrl(deviceId, sessionToken, asset.filePath)
        downloadToFile(signedUrl, file)
        evictIfNeeded()
        return CacheResult.Local(file, "miss")
    }

    suspend fun preloadUpcoming(deviceId: String, sessionToken: String, items: List<ManifestItem>, currentIndex: Int) {
        val upcoming = items.drop(currentIndex + 1).take(2) + items.take((currentIndex + 3 - items.size).coerceAtLeast(0))
        for (item in upcoming) {
            val mimeType = item.asset?.mimeType ?: continue
            if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) {
                runCatching { resolvePlayableUri(deviceId, sessionToken, item) }
            }
        }
    }

    fun evictManifestStale(validFilePaths: Set<String>) {
        val validNames = validFilePaths.map { stableName(it) }.toSet()
        cacheDir.listFiles()?.forEach { file ->
            if (file.name !in validNames) file.delete()
        }
    }

    private suspend fun downloadToFile(url: String, target: File) = withContext(Dispatchers.IO) {
        val tmp = File(target.parentFile, "${target.name}.tmp")
        val response = httpClient.get(url)
        val channel = response.bodyAsChannel()
        tmp.outputStream().use { output ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = channel.readAvailable(buffer, 0, buffer.size)
                if (read == -1) break
                output.write(buffer, 0, read)
            }
        }
        if (!tmp.renameTo(target)) {
            tmp.copyTo(target, overwrite = true)
            tmp.delete()
        }
    }

    private fun evictIfNeeded() {
        val files = cacheDir.listFiles()?.sortedBy { it.lastModified() } ?: return
        var total = files.sumOf { it.length() }
        for (file in files) {
            if (total <= maxCacheBytes) break
            total -= file.length()
            file.delete()
        }
    }

    private fun cacheFile(filePath: String): File = File(cacheDir, stableName(filePath))

    private fun stableName(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}

sealed class CacheResult(val cacheStatus: String) {
    class Local(val file: File, status: String) : CacheResult(status)
    class Remote(val url: String, status: String) : CacheResult(status)
}
