package com.nuexis.player.app.overlay

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import com.nuexis.player.app.diagnostics.StructuredLogger
import kotlin.math.roundToInt

class WebsiteOverlayController(
    private val activity: Activity,
    private val container: FrameLayout,
    private val primaryWebView: WebView,
    private val logger: StructuredLogger
) {
    private val overlays = mutableMapOf<String, WebView>()

    fun show(
        id: String,
        url: String,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        viewportWidth: Double,
        viewportHeight: Double
    ) {
        if (!isAllowedUrl(url) || width <= 0 || height <= 0) {
            logger.warn("overlay_rejected", mapOf("id" to id, "url" to url))
            hide(id)
            return
        }

        activity.runOnUiThread {
            val overlay = overlays.getOrPut(id) { createWebView() }
            val scaleX = primaryWebView.width / viewportWidth.coerceAtLeast(1.0)
            val scaleY = primaryWebView.height / viewportHeight.coerceAtLeast(1.0)
            overlay.layoutParams = FrameLayout.LayoutParams(
                (width * scaleX).roundToInt().coerceAtLeast(1),
                (height * scaleY).roundToInt().coerceAtLeast(1)
            ).apply {
                leftMargin = (x * scaleX).roundToInt()
                topMargin = (y * scaleY).roundToInt()
            }
            overlay.visibility = View.VISIBLE
            overlay.bringToFront()
            if (overlay.url != url) overlay.loadUrl(url)
        }
    }

    fun hide(id: String) {
        activity.runOnUiThread {
            overlays.remove(id)?.let(::destroyWebView)
        }
    }

    fun destroyAll() {
        activity.runOnUiThread {
            overlays.values.toList().forEach(::destroyWebView)
            overlays.clear()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView = WebView(activity).apply {
        setBackgroundColor(Color.TRANSPARENT)
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: android.webkit.WebResourceRequest
            ): Boolean = !isAllowedUrl(request.url.toString())
        }
        container.addView(this)
    }

    private fun destroyWebView(webView: WebView) {
        container.removeView(webView)
        webView.stopLoading()
        webView.loadUrl("about:blank")
        webView.clearHistory()
        webView.removeAllViews()
        webView.destroy()
    }

    private fun isAllowedUrl(value: String): Boolean {
        val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return false
        if (uri.scheme !in setOf("https", "http")) return false
        val host = uri.host?.lowercase() ?: return false
        if (host == "localhost" || host.endsWith(".localhost")) return false
        if (host == "0.0.0.0" || host == "127.0.0.1" || host == "::1") return false
        if (PRIVATE_IPV4.matches(host)) return false
        return true
    }

    companion object {
        private val PRIVATE_IPV4 = Regex(
            """^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)"""
        )
    }
}
