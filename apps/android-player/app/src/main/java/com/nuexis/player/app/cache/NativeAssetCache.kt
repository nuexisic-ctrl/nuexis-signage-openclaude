package com.nuexis.player.app.cache

import android.content.Context
import android.net.Uri
import java.io.File
import java.security.MessageDigest

class NativeAssetCache(context: Context) {
    private val cacheDirectory = File(context.filesDir, "native_asset_cache").apply { mkdirs() }

    fun entry(cacheKey: String): CacheEntry {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(cacheKey.toByteArray())
            .joinToString("") { "%02x".format(it) }
        return CacheEntry(
            data = File(cacheDirectory, "$digest.data"),
            mime = File(cacheDirectory, "$digest.mime")
        )
    }

    fun deriveKey(uri: Uri): String? {
        val path = uri.path ?: return null
        val markers = listOf(
            "/storage/v1/object/sign/workspace-media/",
            "/storage/v1/object/public/workspace-media/"
        )
        markers.forEach { marker ->
            val index = path.indexOf(marker)
            if (index >= 0) return Uri.decode(path.substring(index + marker.length))
        }
        return null
    }

    fun trim(maxBytes: Long = MAX_CACHE_BYTES) {
        val files = cacheDirectory.listFiles { file -> file.extension == "data" }
            ?.sortedByDescending(File::lastModified)
            ?: return
        var retained = 0L
        files.forEach { file ->
            retained += file.length()
            if (retained > maxBytes) {
                File(cacheDirectory, "${file.nameWithoutExtension}.mime").delete()
                file.delete()
            }
        }
    }

    data class CacheEntry(val data: File, val mime: File)

    companion object {
        private const val MAX_CACHE_BYTES = 2L * 1024 * 1024 * 1024
    }
}
