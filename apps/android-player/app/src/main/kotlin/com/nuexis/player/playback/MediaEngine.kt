package com.nuexis.player.playback

import android.content.Context
import android.net.Uri
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import java.io.File

@OptIn(UnstableApi::class)
class MediaEngine(
    private val context: Context,
    private val container: FrameLayout,
    private val storageManager: StorageManager,
    private val supabaseClient: SupabaseClient
) {

    class WebAppInterface(
        private val storageManager: StorageManager,
        private val supabaseClient: SupabaseClient
    ) {
        @JavascriptInterface
        fun getSignedUrl(filePath: String): String {
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret()
            if (secret == null) return filePath
            return try {
                supabaseClient.getSignedMediaUrl(filePath, hardwareId, secret)
            } catch (e: Exception) {
                e.printStackTrace()
                filePath
            }
        }

        @JavascriptInterface
        fun isMuted(): Boolean {
            return storageManager.isMuted()
        }
    }

    class Viewport(
        context: Context,
        val parentLayout: FrameLayout,
        private val storageManager: StorageManager,
        private val supabaseClient: SupabaseClient
    ) {
        val layout = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            alpha = 0f
            visibility = View.GONE
        }

        val imageView = ImageView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            visibility = View.GONE
        }

        val playerView = PlayerView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            useController = false
            visibility = View.GONE
        }

        val webView = WebView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            visibility = View.GONE
            webViewClient = WebViewClient()
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true
                mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = true
            }
            addJavascriptInterface(
                WebAppInterface(storageManager, supabaseClient),
                "AndroidPlayer"
            )
        }

        var exoPlayer: ExoPlayer? = null

        init {
            layout.addView(imageView)
            layout.addView(playerView)
            layout.addView(webView)
            parentLayout.addView(layout)
        }

        fun initPlayer(context: Context, isMuted: Boolean) {
            if (exoPlayer == null) {
                exoPlayer = ExoPlayer.Builder(context).build().apply {
                    repeatMode = Player.REPEAT_MODE_ALL
                    volume = if (isMuted) 0f else 1f
                    playWhenReady = false
                }
                playerView.player = exoPlayer
            }
        }

        fun playImage(file: File, scaleMode: String) {
            stopVideo()
            webView.visibility = View.GONE
            playerView.visibility = View.GONE

            imageView.setImageURI(Uri.fromFile(file))
            applyImageScale(scaleMode)
            imageView.visibility = View.VISIBLE
        }

        fun playVideo(file: File, scaleMode: String, isMuted: Boolean) {
            imageView.visibility = View.GONE
            webView.visibility = View.GONE
            playerView.visibility = View.VISIBLE

            initPlayer(layout.context, isMuted)
            applyVideoScale(scaleMode)
            exoPlayer?.volume = if (isMuted) 0f else 1f

            val mediaItem = MediaItem.fromUri(Uri.fromFile(file))
            exoPlayer?.setMediaItem(mediaItem)
            exoPlayer?.prepare()
            exoPlayer?.playWhenReady = true
            exoPlayer?.play()
        }

        fun playWidget(mimeType: String, configJson: String) {
            imageView.visibility = View.GONE
            playerView.visibility = View.GONE
            stopVideo()

            if (mimeType == "application/x-widget-remote-url" || mimeType == "application/x-widget-website") {
                webView.webViewClient = object : WebViewClient() {
                    override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                        super.onReceivedError(view, errorCode, description, failingUrl)
                        Log.e("MediaEngine", "Website widget error loading $failingUrl: $description")
                    }
                }
                var targetUrl = configJson
                try {
                    val jsonObject = com.google.gson.JsonParser.parseString(configJson).asJsonObject
                    if (jsonObject.has("url")) {
                        targetUrl = jsonObject.get("url").asString
                    }
                } catch (e: Exception) {
                    // Not JSON or missing url key, use raw string
                }
                
                if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
                    webView.loadUrl(targetUrl)
                } else {
                    webView.loadUrl("about:blank")
                }
                webView.visibility = View.VISIBLE
                return
            }

            webView.webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    val javaScriptBridgeInit = """
                        if (typeof window.renderWidget !== 'function') {
                            window.renderWidget = function(mime, cfg) {
                                console.log('renderWidget not loaded yet');
                            };
                        }
                    """.trimIndent()
                    webView.evaluateJavascript(javaScriptBridgeInit, null)
                    val escapedConfig = configJson.replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r")
                    webView.evaluateJavascript("javascript:renderWidget('$mimeType', '$escapedConfig')", null)
                }

                override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                    super.onReceivedError(view, errorCode, description, failingUrl)
                    Log.e("MediaEngine", "Local widget error loading $failingUrl: $description")
                }
            }
            webView.loadUrl("file:///android_asset/widget_bootstrap.html")
            webView.visibility = View.VISIBLE
        }

        fun stopVideo() {
            exoPlayer?.stop()
            exoPlayer?.clearMediaItems()
        }

        fun setMuted(muted: Boolean) {
            exoPlayer?.volume = if (muted) 0f else 1f
        }

        private fun applyImageScale(scaleMode: String) {
            imageView.scaleType = when (scaleMode) {
                "None" -> ImageView.ScaleType.CENTER
                "Fit" -> ImageView.ScaleType.FIT_CENTER
                "Stretch" -> ImageView.ScaleType.FIT_XY
                "Zoom" -> ImageView.ScaleType.CENTER_CROP
                else -> ImageView.ScaleType.FIT_CENTER
            }
        }

        private fun applyVideoScale(scaleMode: String) {
            playerView.resizeMode = when (scaleMode) {
                "None" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                "Fit" -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                "Stretch" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
                "Zoom" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
            }
        }

        fun release() {
            stopVideo()
            exoPlayer?.release()
            exoPlayer = null
            playerView.player = null
            // Remove layout from parent before destroying WebView to avoid
            // "WebView received an Intent broadcast it didn't register for" leaks
            // when the parent FrameLayout has already been recycled by Activity.
            try {
                (layout.parent as? ViewGroup)?.removeView(layout)
            } catch (_: Exception) {}
            webView.destroy()
        }
    }

    private var viewportA = Viewport(context, container, storageManager, supabaseClient)
    private var viewportB = Viewport(context, container, storageManager, supabaseClient)

    private var activeViewport: Viewport = viewportA
    private var preloadViewport: Viewport = viewportB

    init {
        activeViewport.layout.alpha = 1f
        activeViewport.layout.visibility = View.VISIBLE
    }

    fun playImage(file: File, scaleMode: String) {
        activeViewport.playImage(file, scaleMode)
        activeViewport.layout.alpha = 1f
        activeViewport.layout.visibility = View.VISIBLE
        
        // Hide preload viewport in case it was showing something
        preloadViewport.layout.visibility = View.GONE
        preloadViewport.layout.alpha = 0f
        preloadViewport.stopVideo()
    }

    fun playVideo(file: File, scaleMode: String, isMuted: Boolean) {
        activeViewport.playVideo(file, scaleMode, isMuted)
        activeViewport.layout.alpha = 1f
        activeViewport.layout.visibility = View.VISIBLE

        preloadViewport.layout.visibility = View.GONE
        preloadViewport.layout.alpha = 0f
        preloadViewport.stopVideo()
    }

    fun playWidget(mimeType: String, configJson: String) {
        activeViewport.playWidget(mimeType, configJson)
        activeViewport.layout.alpha = 1f
        activeViewport.layout.visibility = View.VISIBLE

        preloadViewport.layout.visibility = View.GONE
        preloadViewport.layout.alpha = 0f
        preloadViewport.stopVideo()
    }

    fun preloadImage(file: File, scaleMode: String) {
        preloadViewport.playImage(file, scaleMode)
        preloadViewport.layout.alpha = 0f
        preloadViewport.layout.visibility = View.VISIBLE
    }

    fun preloadVideo(file: File, scaleMode: String, isMuted: Boolean) {
        preloadViewport.playVideo(file, scaleMode, isMuted)
        preloadViewport.exoPlayer?.playWhenReady = false
        preloadViewport.layout.alpha = 0f
        preloadViewport.layout.visibility = View.VISIBLE
    }

    fun preloadWidget(mimeType: String, configJson: String) {
        preloadViewport.playWidget(mimeType, configJson)
        preloadViewport.layout.alpha = 0f
        preloadViewport.layout.visibility = View.VISIBLE
    }

    fun transitionToNext(transitionMs: Long = 350, onTransitionComplete: () -> Unit = {}) {
        val oldActive = activeViewport
        val oldPreload = preloadViewport

        oldPreload.exoPlayer?.playWhenReady = true
        oldPreload.exoPlayer?.play()

        oldPreload.layout.animate()
            .alpha(1f)
            .setDuration(transitionMs)
            .start()

        oldActive.layout.animate()
            .alpha(0f)
            .setDuration(transitionMs)
            .withEndAction {
                oldActive.layout.visibility = View.GONE
                oldActive.stopVideo()
                
                activeViewport = oldPreload
                preloadViewport = oldActive
                
                onTransitionComplete()
            }
            .start()
    }

    fun stopAll() {
        viewportA.layout.visibility = View.GONE
        viewportA.layout.alpha = 0f
        viewportA.stopVideo()

        viewportB.layout.visibility = View.GONE
        viewportB.layout.alpha = 0f
        viewportB.stopVideo()
    }

    fun setMuted(muted: Boolean) {
        viewportA.setMuted(muted)
        viewportB.setMuted(muted)
    }

    fun release() {
        viewportA.release()
        viewportB.release()
    }
}
