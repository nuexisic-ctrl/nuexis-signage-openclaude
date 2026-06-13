package com.nuexis.player.ui.player

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.nuexis.player.data.local.CachedPlaylistItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

@Composable
fun PlayableItem(
    item: CachedPlaylistItem,
    scaleMode: String,
    isMuted: Boolean,
    isActive: Boolean,
    onMediaLoaded: () -> Unit,
    onMediaError: (String) -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        when (item.type) {
            "image" -> {
                ImageRenderer(item, scaleMode, onMediaLoaded, onMediaError)
            }
            "video" -> {
                VideoRenderer(item, scaleMode, isMuted, isActive, onMediaLoaded, onMediaError)
            }
            "widget" -> {
                WidgetRenderer(item, isMuted, isActive, onMediaLoaded, onMediaError)
            }
            else -> {
                // Fallback empty view
                onMediaLoaded()
            }
        }
    }
}

@Composable
private fun ImageRenderer(
    item: CachedPlaylistItem,
    scaleMode: String,
    onMediaLoaded: () -> Unit,
    onMediaError: (String) -> Unit
) {
    val bitmapState = produceState<Bitmap?>(initialValue = null, key1 = item.localUri) {
        if (!item.localUri.isNullOrEmpty()) {
            val file = File(item.localUri)
            if (file.exists()) {
                value = withContext(Dispatchers.IO) {
                    try {
                        val options = BitmapFactory.Options().apply {
                            inJustDecodeBounds = true
                        }
                        BitmapFactory.decodeFile(file.absolutePath, options)
                        
                        options.inSampleSize = calculateInSampleSize(options, 1920, 1080)
                        options.inJustDecodeBounds = false
                        
                        BitmapFactory.decodeFile(file.absolutePath, options)
                    } catch (e: Exception) {
                        val errorMsg = "Error decoding bitmap: ${e.message}"
                        Log.e("ImageRenderer", errorMsg, e)
                        onMediaError(errorMsg)
                        null
                    }
                }
            } else {
                onMediaError("Image file not found: ${item.localUri}")
            }
        } else {
            onMediaError("Image URI is null or empty")
        }
    }

    val bitmap = bitmapState.value

    LaunchedEffect(bitmap) {
        if (bitmap != null) {
            onMediaLoaded()
        }
    }

    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = null,
            contentScale = when (scaleMode) {
                "Fit" -> ContentScale.Fit
                "Stretch" -> ContentScale.FillBounds
                "Zoom" -> ContentScale.Crop
                else -> ContentScale.Fit
            },
            modifier = Modifier.fillMaxSize()
        )
    } else {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF07111F))
        )
    }
}

private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
    val height = options.outHeight
    val width = options.outWidth
    var inSampleSize = 1

    if (height > reqHeight || width > reqWidth) {
        val halfHeight = height / 2
        val halfWidth = width / 2

        while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
            inSampleSize *= 2
        }
    }
    return inSampleSize
}

@Composable
private fun VideoRenderer(
    item: CachedPlaylistItem,
    scaleMode: String,
    isMuted: Boolean,
    isActive: Boolean,
    onMediaLoaded: () -> Unit,
    onMediaError: (String) -> Unit
) {
    val context = LocalContext.current
    val localUri = item.localUri

    if (localUri.isNullOrEmpty()) {
        LaunchedEffect(Unit) {
            onMediaError("Video local URI is null or empty")
            onMediaLoaded()
        }
        return
    }

    val videoFile = remember(localUri) { File(localUri) }
    if (!videoFile.exists()) {
        LaunchedEffect(Unit) {
            val errorMsg = "Video file does not exist: $localUri"
            Log.e("VideoRenderer", errorMsg)
            onMediaError(errorMsg)
            onMediaLoaded()
        }
        return
    }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_ALL
            playWhenReady = isActive
            volume = if (isMuted || !isActive) 0f else 1f
        }
    }

    // Handle updates to mute setting and active state dynamically
    LaunchedEffect(isActive, isMuted) {
        exoPlayer.playWhenReady = isActive
        exoPlayer.volume = if (isMuted || !isActive) 0f else 1f
    }

    // Set media source
    LaunchedEffect(videoFile) {
        val uri = Uri.fromFile(videoFile)
        val mediaItem = MediaItem.fromUri(uri)
        
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    onMediaLoaded()
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                val errorMsg = "ExoPlayer error: ${error.message}"
                Log.e("VideoRenderer", errorMsg, error)
                onMediaError(errorMsg)
                onMediaLoaded() // Advance gracefully
            }
        }

        exoPlayer.addListener(listener)
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        
        try {
            awaitCancellation()
        } finally {
            exoPlayer.removeListener(listener)
        }
    }

    DisposableEffect(exoPlayer) {
        onDispose {
            exoPlayer.release()
        }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = false // Hide controls for signage
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                resizeMode = when (scaleMode) {
                    "Fit" -> androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
                    "Stretch" -> androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FILL
                    "Zoom" -> androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    else -> androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
                }
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
private fun WidgetRenderer(
    item: CachedPlaylistItem,
    isMuted: Boolean,
    isActive: Boolean,
    onMediaLoaded: () -> Unit,
    onMediaError: (String) -> Unit
) {
    val mimeType = item.mimeType ?: ""

    when {
        mimeType == "application/x-widget-flow" -> {
            LaunchedEffect(Unit) { onMediaLoaded() }
            NativeClockWidget(configStr = item.widgetConfig)
        }
        mimeType == "application/x-widget-worldclock" -> {
            LaunchedEffect(Unit) { onMediaLoaded() }
            NativeWorldClockWidget(configStr = item.widgetConfig)
        }
        mimeType == "application/x-widget-countdown" -> {
            LaunchedEffect(Unit) { onMediaLoaded() }
            NativeCountdownWidget(configStr = item.widgetConfig)
        }
        mimeType == "application/x-widget-countup" -> {
            LaunchedEffect(Unit) { onMediaLoaded() }
            NativeCountUpWidget(configStr = item.widgetConfig)
        }
        mimeType == "application/x-widget-html" -> {
            HtmlWidgetRenderer(item.widgetConfig, isActive, onMediaLoaded)
        }
        mimeType == "application/x-widget-website" || mimeType == "application/x-widget-remote-url" -> {
            WebsiteWidgetRenderer(item.widgetConfig ?: item.localUri, isActive, onMediaLoaded)
        }
        mimeType == "application/x-widget-youtube" -> {
            YouTubeWidgetRenderer(urlStr = item.widgetConfig ?: item.localUri, isMuted = isMuted, isActive = isActive, onMediaLoaded = onMediaLoaded)
        }
        mimeType == "application/x-widget-youtube-playlist" -> {
            YouTubePlaylistWidgetRenderer(configStr = item.widgetConfig ?: item.localUri, isMuted = isMuted, isActive = isActive, onMediaLoaded = onMediaLoaded)
        }
        else -> {
            // Unhandled widget
            LaunchedEffect(Unit) {
                onMediaError("Unhandled widget mimeType: $mimeType")
                onMediaLoaded()
            }
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF07111F))
            )
        }
    }
}

private fun isNetworkAvailable(context: Context): Boolean {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = connectivityManager.activeNetwork ?: return false
    val activeNetwork = connectivityManager.getNetworkCapabilities(network) ?: return false
    return activeNetwork.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun WebViewContainer(
    url: String,
    isActive: Boolean,
    onMediaLoaded: () -> Unit
) {
    val context = LocalContext.current
    
    val webView = remember {
        WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0) // Transparent background
            setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
            
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                useWideViewPort = true
                loadWithOverviewMode = true
                mediaPlaybackRequiresUserGesture = false
                
                // Sandbox WebView security hardening
                allowFileAccess = false
                allowContentAccess = false
                
                cacheMode = if (isNetworkAvailable(context)) {
                    WebSettings.LOAD_DEFAULT
                } else {
                    WebSettings.LOAD_CACHE_ELSE_NETWORK
                }
                
                userAgentString = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        }
    }

    // Map activation state to WebView lifecycle
    LaunchedEffect(isActive) {
        if (isActive) {
            webView.onResume()
            webView.resumeTimers()
        } else {
            webView.onPause()
            webView.pauseTimers()
        }
    }

    LaunchedEffect(url) {
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                view?.evaluateJavascript(
                    """
                    (function() {
                        var parent = document.getElementsByTagName('head').item(0);
                        var style = document.createElement('style');
                        style.type = 'text/css';
                        style.innerHTML = 'body { overflow: hidden !important; margin: 0 !important; padding: 0 !important; } ::-webkit-scrollbar { display: none !important; }';
                        if (parent) {
                            parent.appendChild(style);
                        } else {
                            document.documentElement.appendChild(style);
                        }
                    })();
                    """.trimIndent(), null
                )
                onMediaLoaded()
            }
        }
        webView.loadUrl(url)
    }

    DisposableEffect(webView) {
        onDispose {
            try {
                webView.stopLoading()
                webView.loadUrl("about:blank")
                webView.clearHistory()
                webView.removeAllViews()
                webView.destroy()
            } catch (e: Exception) {
                Log.e("WebViewContainer", "Error destroying WebView", e)
            }
        }
    }

    AndroidView(
        factory = { webView },
        modifier = Modifier.fillMaxSize()
    )
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun HtmlWidgetRenderer(
    configStr: String?,
    isActive: Boolean,
    onMediaLoaded: () -> Unit
) {
    val htmlContent = remember(configStr) {
        try {
            if (configStr != null) {
                val root = Json.parseToJsonElement(configStr).jsonObject
                val html = root["html"]?.jsonPrimitive?.content ?: ""
                val css = root["css"]?.jsonPrimitive?.content ?: ""
                
                """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                            overflow: hidden;
                            background: transparent;
                            color: white;
                            font-family: sans-serif;
                        }
                        ::-webkit-scrollbar {
                            display: none !important;
                        }
                        $css
                    </style>
                </head>
                <body>
                    $html
                </body>
                </html>
                """.trimIndent()
            } else ""
        } catch (e: Exception) {
            Log.e("HtmlWidgetRenderer", "Error parsing custom HTML widget config", e)
            ""
        }
    }

    if (htmlContent.isEmpty()) {
        LaunchedEffect(Unit) { onMediaLoaded() }
        return
    }

    val context = LocalContext.current
    val webView = remember {
        WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0) // Transparent background
            setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
            
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                useWideViewPort = true
                loadWithOverviewMode = true
                allowFileAccess = false
                allowContentAccess = false
                cacheMode = if (isNetworkAvailable(context)) {
                    WebSettings.LOAD_DEFAULT
                } else {
                    WebSettings.LOAD_CACHE_ELSE_NETWORK
                }
            }
        }
    }

    LaunchedEffect(isActive) {
        if (isActive) {
            webView.onResume()
            webView.resumeTimers()
        } else {
            webView.onPause()
            webView.pauseTimers()
        }
    }

    LaunchedEffect(htmlContent) {
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                onMediaLoaded()
            }
        }
        webView.loadDataWithBaseURL(null, htmlContent, "text/html", "UTF-8", null)
    }

    DisposableEffect(webView) {
        onDispose {
            try {
                webView.stopLoading()
                webView.loadUrl("about:blank")
                webView.clearHistory()
                webView.removeAllViews()
                webView.destroy()
            } catch (e: Exception) {
                Log.e("HtmlWidgetRenderer", "Error destroying WebView", e)
            }
        }
    }

    AndroidView(
        factory = { webView },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
private fun WebsiteWidgetRenderer(
    urlStr: String?,
    isActive: Boolean,
    onMediaLoaded: () -> Unit
) {
    val targetUrl = remember(urlStr) {
        if (urlStr.isNullOrEmpty()) ""
        else {
            try {
                if (urlStr.trim().startsWith("{")) {
                    val root = Json.parseToJsonElement(urlStr).jsonObject
                    root["url"]?.jsonPrimitive?.content ?: urlStr
                } else urlStr
            } catch (e: Exception) {
                urlStr
            }
        }
    }

    if (targetUrl.isEmpty()) {
        LaunchedEffect(Unit) { onMediaLoaded() }
        return
    }

    WebViewContainer(url = targetUrl, isActive = isActive, onMediaLoaded = onMediaLoaded)
}

private fun String.matchVideoId(): String? {
    val patterns = listOf(
        Regex("youtu\\.be/([^?&]+)"),
        Regex("youtube\\.com/embed/([^?&]+)"),
        Regex("youtube\\.com/v/([^?&]+)"),
        Regex("youtube\\.com/watch\\?v=([^?&]+)"),
        Regex("youtube\\.com/watch\\?.+&v=([^?&]+)")
    )
    for (pattern in patterns) {
        val match = pattern.find(this)
        if (match != null && match.groupValues.size > 1) {
            return match.groupValues[1]
        }
    }
    return null
}

@Composable
private fun YouTubeWidgetRenderer(
    urlStr: String?,
    isMuted: Boolean,
    isActive: Boolean,
    onMediaLoaded: () -> Unit
) {
    val targetUrl = remember(urlStr) {
        if (urlStr.isNullOrEmpty()) ""
        else {
            try {
                val rawUrl = if (urlStr.trim().startsWith("{")) {
                    val root = Json.parseToJsonElement(urlStr).jsonObject
                    root["url"]?.jsonPrimitive?.content ?: urlStr
                } else urlStr
                
                val videoId = rawUrl.matchVideoId() ?: ""
                if (videoId.isNotEmpty()) {
                    "https://www.youtube.com/embed/$videoId?autoplay=1&mute=${if (isMuted) 1 else 0}&loop=1&playlist=$videoId&controls=0"
                } else rawUrl
            } catch (e: Exception) {
                urlStr
            }
        }
    }

    if (targetUrl.isEmpty()) {
        LaunchedEffect(Unit) { onMediaLoaded() }
        return
    }

    WebViewContainer(url = targetUrl, isActive = isActive, onMediaLoaded = onMediaLoaded)
}

@Composable
private fun YouTubePlaylistWidgetRenderer(
    configStr: String?,
    isMuted: Boolean,
    isActive: Boolean,
    onMediaLoaded: () -> Unit
) {
    val targetUrl = remember(configStr) {
        if (configStr.isNullOrEmpty()) ""
        else {
            try {
                if (configStr.trim().startsWith("{")) {
                    val root = Json.parseToJsonElement(configStr).jsonObject
                    val url = root["url"]?.jsonPrimitive?.content ?: ""
                    val ccEnabled = root["ccEnabled"]?.jsonPrimitive?.content?.toBoolean() ?: false
                    val shuffleEnabled = root["shuffleEnabled"]?.jsonPrimitive?.content?.toBoolean() ?: false
                    
                    val playlistId = url.substringAfter("list=", "")
                    if (playlistId.isNotEmpty()) {
                        val ccParam = if (ccEnabled) "&cc_load_policy=1" else ""
                        val shuffleParam = if (shuffleEnabled) "&shuffle=1" else ""
                        "https://www.youtube.com/embed?listType=playlist&list=$playlistId&autoplay=1&mute=${if (isMuted) 1 else 0}&loop=1&controls=0$ccParam$shuffleParam"
                    } else url
                } else {
                    configStr
                }
            } catch (e: Exception) {
                configStr
            }
        }
    }

    if (targetUrl.isEmpty()) {
        LaunchedEffect(Unit) { onMediaLoaded() }
        return
    }

    WebViewContainer(url = targetUrl, isActive = isActive, onMediaLoaded = onMediaLoaded)
}
