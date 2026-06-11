package com.nuexis.player.app.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.nuexis.player.app.cache.NativeAssetCache
import com.nuexis.player.app.diagnostics.StructuredLogger
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.nuexis.player.core.network.di.DownloadClient
import okhttp3.OkHttpClient
import okhttp3.Request

@HiltWorker
class AssetCacheWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    @DownloadClient private val httpClient: OkHttpClient,
    private val logger: StructuredLogger
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val url = inputData.getString(KEY_URL) ?: return@withContext Result.failure()
        val cacheKey = inputData.getString(KEY_CACHE_KEY) ?: return@withContext Result.failure()
        val mimeType = inputData.getString(KEY_MIME_TYPE).orEmpty()
        val cache = NativeAssetCache(applicationContext)
        val entry = cache.entry(cacheKey)
        val temporary = java.io.File(entry.data.parentFile, "${entry.data.name}.part")

        runCatching {
            httpClient.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
                if (!response.isSuccessful) error("HTTP ${response.code}")
                val body = response.body ?: error("Empty response")
                temporary.outputStream().buffered().use { output ->
                    body.byteStream().use { input -> input.copyTo(output) }
                }
                if (entry.data.exists()) entry.data.delete()
                check(temporary.renameTo(entry.data)) { "Could not finalize cached asset" }
                entry.mime.writeText(
                    mimeType.ifBlank {
                        response.header("Content-Type")
                            ?.substringBefore(';')
                            .orEmpty()
                    }
                )
                entry.data.setLastModified(System.currentTimeMillis())
                cache.trim()
                logger.info("asset_cached", mapOf("cacheKey" to cacheKey))
            }
        }.fold(
            onSuccess = { Result.success() },
            onFailure = {
                temporary.delete()
                logger.warn(
                    "asset_cache_failed",
                    mapOf("cacheKey" to cacheKey, "error" to (it.message ?: "unknown"))
                )
                if (runAttemptCount < 5) Result.retry() else Result.failure()
            }
        )
    }

    companion object {
        const val KEY_URL = "url"
        const val KEY_CACHE_KEY = "cache_key"
        const val KEY_MIME_TYPE = "mime_type"
    }
}
