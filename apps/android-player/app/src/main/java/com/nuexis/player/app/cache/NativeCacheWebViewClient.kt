package com.nuexis.player.app.cache

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import com.nuexis.player.app.diagnostics.StructuredLogger
import java.io.FileInputStream
import java.net.URLConnection

open class NativeCacheWebViewClient(
    context: Context,
    private val playerUri: Uri,
    private val logger: StructuredLogger
) : WebViewClient() {
    private val cache = NativeAssetCache(context)

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return false
        val uri = request.url
        return uri.scheme !in setOf("https", "http") ||
            uri.host != playerUri.host
    }

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? {
        if (request.method != "GET") return null
        val cacheKey = cache.deriveKey(request.url) ?: return null
        val entry = cache.entry(cacheKey)
        if (!entry.data.exists()) return null

        val mime = entry.mime.takeIf { it.exists() }?.readText()?.ifBlank { null }
            ?: URLConnection.guessContentTypeFromName(cacheKey)
            ?: "application/octet-stream"
        val range = request.requestHeaders["Range"]
        return if (range == null) {
            WebResourceResponse(mime, null, FileInputStream(entry.data))
        } else {
            rangeResponse(entry.data.length(), range, mime, entry.data)
        }
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        logger.info("page_started", mapOf("url" to url))
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError
    ) {
        super.onReceivedError(view, request, error)
        if (request.isForMainFrame) {
            logger.warn(
                "main_frame_error",
                mapOf(
                    "code" to error.errorCode.toString(),
                    "description" to error.description.toString()
                )
            )
            view.settings.cacheMode = android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
        }
    }

    private fun rangeResponse(
        totalLength: Long,
        rangeHeader: String,
        mime: String,
        file: java.io.File
    ): WebResourceResponse? {
        val match = RANGE_PATTERN.find(rangeHeader) ?: return null
        val start = match.groupValues[1].toLongOrNull() ?: return null
        val requestedEnd = match.groupValues[2].toLongOrNull()
        if (start >= totalLength) return null
        val end = minOf(requestedEnd ?: totalLength - 1, totalLength - 1)
        val length = end - start + 1
        val input = FileInputStream(file)
        input.channel.position(start)
        return WebResourceResponse(
            mime,
            null,
            206,
            "Partial Content",
            mapOf(
                "Accept-Ranges" to "bytes",
                "Content-Length" to length.toString(),
                "Content-Range" to "bytes $start-$end/$totalLength"
            ),
            BoundedInputStream(input, length)
        )
    }

    companion object {
        private val RANGE_PATTERN = Regex("""bytes=(\d+)-(\d*)""")
    }
}
