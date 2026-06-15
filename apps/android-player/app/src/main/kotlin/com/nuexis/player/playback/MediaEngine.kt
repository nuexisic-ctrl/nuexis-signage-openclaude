package com.nuexis.player.playback

import android.content.Context
import android.net.Uri
import android.view.View
import android.view.ViewGroup
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
import java.io.File

@OptIn(UnstableApi::class)
class MediaEngine(private val context: Context, private val container: FrameLayout) {

    class Viewport(context: Context, val parentLayout: FrameLayout) {
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
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = true
            }
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

            webView.webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    val escapedConfig = configJson.replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r")
                    webView.evaluateJavascript("javascript:renderWidget('$mimeType', '$escapedConfig')", null)
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
            webView.destroy()
        }
    }

    private var viewportA = Viewport(context, container)
    private var viewportB = Viewport(context, container)

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
        // Make sure it doesn't start playing loudly or visibly in background until transition
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

        // Start playing the video in preload viewport if there is one
        oldPreload.exoPlayer?.playWhenReady = true
        oldPreload.exoPlayer?.play()

        // Animate cross-fade
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
                
                // Swap active and preload viewports
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
