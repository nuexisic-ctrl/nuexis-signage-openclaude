package com.nuexis.player.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.nuexis.player.cache.CacheResult
import com.nuexis.player.cache.MediaCacheManager
import com.nuexis.player.config.PlayerConfig
import com.nuexis.player.data.DeviceSessionResponse
import com.nuexis.player.data.ManifestItem
import com.nuexis.player.data.PlaybackEventRequest
import com.nuexis.player.data.PlaybackEventType
import com.nuexis.player.data.PlayerManifest
import com.nuexis.player.network.SupabaseGateway
import com.nuexis.player.playback.PlaylistResolver
import com.nuexis.player.realtime.RealtimeManager
import com.nuexis.player.security.PairingCodeGenerator
import com.nuexis.player.system.PlayerForegroundService
import com.nuexis.player.system.PlayerWorkScheduler
import com.nuexis.player.utils.HardwareIdHelper
import com.nuexis.player.utils.SecureStorage
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import java.time.Instant

class PlayerActivity : AppCompatActivity() {
    private lateinit var root: FrameLayout
    private lateinit var statusText: TextView
    private lateinit var pairingText: TextView
    private lateinit var playerView: PlayerView
    private lateinit var imageView: ImageView
    private lateinit var webView: WebView

    private val gateway by lazy { SupabaseGateway() }
    private val cache by lazy { MediaCacheManager(this, gateway) }
    private var exoPlayer: ExoPlayer? = null
    private var playbackJob: Job? = null
    private var pairingJob: Job? = null
    private var realtime: RealtimeManager? = null
    private var activeSession: DeviceSessionResponse? = null
    private var currentIndex = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupKioskMode()
        setupViews()
        PlayerWorkScheduler.schedule(this)
        startRuntimeService()

        if (!PlayerConfig.isConfigured) {
            showFatal("Android player is not configured.\nSet SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and PLAYER_API_BASE_URL in Gradle properties.")
            return
        }

        lifecycleScope.launch { bootPlayer() }
    }

    override fun onResume() {
        super.onResume()
        setupKioskMode()
        exoPlayer?.play()
    }

    override fun onPause() {
        super.onPause()
        exoPlayer?.pause()
    }

    override fun onDestroy() {
        playbackJob?.cancel()
        pairingJob?.cancel()
        realtime?.stop()
        exoPlayer?.release()
        webView.destroy()
        super.onDestroy()
    }

    private suspend fun bootPlayer() {
        showStatus("Starting native signage runtime...")
        val hardwareId = HardwareIdHelper.getHardwareId(this)
        val savedSecret = SecureStorage.getDeviceSecret(this)

        try {
            val existing = gateway.getDeviceState(hardwareId, savedSecret)
            if (existing?.teamId != null && savedSecret != null) {
                SecureStorage.saveDeviceIdentity(this, existing.id, existing.teamId)
                pairAndStart(existing.id, existing.teamId, hardwareId, savedSecret)
                return
            }
            startPairing(hardwareId, savedSecret, existing?.id)
        } catch (_: Throwable) {
            val cached = SecureStorage.getLastManifest(this)
            if (cached != null) {
                showStatus("Offline mode: using last valid manifest")
                playManifest(SupabaseGateway.json.decodeFromString<PlayerManifest>(cached))
            } else {
                showFatal("Network unavailable and no cached manifest exists yet.")
            }
        }
    }

    private suspend fun startPairing(hardwareId: String, savedSecret: String?, existingDeviceId: String?) {
        val code = PairingCodeGenerator.generate()
        val expiresAt = Instant.now().plusSeconds(15 * 60).toString()
        val registered = if (savedSecret != null && existingDeviceId != null) {
            gateway.refreshPairingCode(existingDeviceId, hardwareId, savedSecret, code, expiresAt)
        } else {
            gateway.registerDevice(hardwareId, code, expiresAt).also {
                SecureStorage.saveDeviceSecret(this, it.secret)
            }
        }

        SecureStorage.saveDeviceIdentity(this, registered.id)
        showPairing(code)

        pairingJob?.cancel()
        pairingJob = lifecycleScope.launch {
            while (true) {
                delay(5_000)
                val state = runCatching {
                    gateway.getDeviceState(hardwareId, SecureStorage.getDeviceSecret(this@PlayerActivity))
                }.getOrNull()
                if (state?.teamId != null) {
                    pairAndStart(state.id, state.teamId, hardwareId, SecureStorage.getDeviceSecret(this@PlayerActivity)!!)
                    break
                }
            }
        }
    }

    private suspend fun pairAndStart(deviceId: String, teamId: String, hardwareId: String, secret: String) {
        showStatus("Pairing confirmed. Establishing signed device session...")
        val session = gateway.exchangeSession(deviceId, hardwareId, secret)
        activeSession = session
        SecureStorage.saveDeviceIdentity(this, session.deviceId, session.teamId)
        SecureStorage.saveSession(this, session.sessionToken, session.expiresAt)
        val manifest = session.manifest ?: gateway.getManifest(session.deviceId, session.sessionToken)
        applyManifest(manifest)
        startRealtime(session, manifest)
    }

    private suspend fun refreshManifest() {
        val session = activeSession ?: return
        val manifest = gateway.getManifest(session.deviceId, session.sessionToken)
        applyManifest(manifest)
    }

    private fun startRealtime(session: DeviceSessionResponse, manifest: PlayerManifest) {
        realtime?.stop()
        realtime = RealtimeManager(
            scope = lifecycleScope,
            onManifestRefresh = { refreshManifest() },
            onReconnectState = { online ->
                if (!online) showStatus("Realtime reconnecting... playback continues locally")
            }
        )
        realtime?.start(session.deviceId, session.teamId, session.sessionToken, manifest.manifestVersion)
    }

    private suspend fun applyManifest(manifest: PlayerManifest) {
        SecureStorage.saveLastManifest(this, SupabaseGateway.json.encodeToString(manifest))
        val validPaths = manifest.playlist.mapNotNull { it.asset?.filePath }.filterNot { it.startsWith("http") }.toSet()
        cache.evictManifestStale(validPaths)
        playManifest(manifest)
    }

    private fun playManifest(manifest: PlayerManifest) {
        val items = PlaylistResolver.playableItems(manifest)
        if (items.isEmpty()) {
            showStatus("No native playable content assigned.")
            return
        }
        currentIndex = currentIndex.coerceAtMost(items.lastIndex)
        playbackJob?.cancel()
        playbackJob = lifecycleScope.launch { playLoop(items) }
    }

    private suspend fun playLoop(items: List<ManifestItem>) {
        while (true) {
            val item = items[currentIndex]
            playItem(item, currentIndex, items)
            currentIndex = (currentIndex + 1) % items.size
        }
    }

    private suspend fun playItem(item: ManifestItem, index: Int, items: List<ManifestItem>) {
        val session = activeSession
        val asset = item.asset
        if (session == null || asset == null) {
            showStatus("Waiting for playable assignment...")
            delay(5_000)
            return
        }

        reportPlayback(item, PlaybackEventType.START)
        val mimeType = asset.mimeType
        try {
            when {
                mimeType.startsWith("video/") -> playVideo(item)
                mimeType.startsWith("image/") -> playImage(item)
                mimeType == "application/x-widget-youtube" -> playYouTube(item)
                mimeType == "application/x-widget-remote-url" -> playRemoteUrl(item)
                else -> delay(item.durationSeconds * 1000L)
            }
            cache.preloadUpcoming(session.deviceId, session.sessionToken, items, index)
            reportPlayback(item, PlaybackEventType.COMPLETE)
        } catch (error: Throwable) {
            reportPlayback(item, PlaybackEventType.ERROR, error.message)
            showStatus("Playback error: ${error.message ?: "unknown"}")
            delay(3_000)
        }
    }

    private suspend fun playVideo(item: ManifestItem) {
        val resolved = resolveItem(item)
        hideAllSurfaces()
        playerView.visibility = View.VISIBLE
        val player = exoPlayer ?: ExoPlayer.Builder(this).build().also {
            exoPlayer = it
            playerView.player = it
        }
        val uri = when (resolved) {
            is CacheResult.Local -> Uri.fromFile(resolved.file)
            is CacheResult.Remote -> Uri.parse(resolved.url)
        }
        player.setMediaItem(MediaItem.fromUri(uri))
        player.repeatMode = Player.REPEAT_MODE_OFF
        player.prepare()
        player.playWhenReady = true
        reportPlayback(item, PlaybackEventType.READY, cacheStatus = resolved.cacheStatus)
        waitForVideoEnd(player, item.durationSeconds)
    }

    private suspend fun playImage(item: ManifestItem) {
        val resolved = resolveItem(item)
        hideAllSurfaces()
        imageView.visibility = View.VISIBLE
        when (resolved) {
            is CacheResult.Local -> imageView.setImageURI(Uri.fromFile(resolved.file))
            is CacheResult.Remote -> imageView.setImageURI(Uri.parse(resolved.url))
        }
        reportPlayback(item, PlaybackEventType.READY, cacheStatus = resolved.cacheStatus)
        delay(item.durationSeconds.coerceAtLeast(1) * 1000L)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private suspend fun playYouTube(item: ManifestItem) {
        val url = item.asset?.filePath.orEmpty()
        val videoId = Regex("(?:youtu\\.be/|youtube\\.com/(?:embed/|v/|watch\\?v=|watch\\?.+&v=))([^&?]+)").find(url)?.groupValues?.getOrNull(1)
        val embedUrl = if (videoId != null) {
            "https://www.youtube.com/embed/$videoId?autoplay=1&mute=1&controls=0&loop=1&playlist=$videoId"
        } else {
            url
        }
        playWebSurface(item, embedUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private suspend fun playRemoteUrl(item: ManifestItem) {
        playWebSurface(item, item.asset?.filePath.orEmpty())
    }

    private suspend fun playWebSurface(item: ManifestItem, url: String) {
        hideAllSurfaces()
        webView.visibility = View.VISIBLE
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        webView.loadUrl(url)
        reportPlayback(item, PlaybackEventType.READY, cacheStatus = "web-fallback")
        delay(item.durationSeconds.coerceAtLeast(5) * 1000L)
    }

    private suspend fun resolveItem(item: ManifestItem): CacheResult {
        val session = activeSession ?: throw IllegalStateException("No active device session")
        return cache.resolvePlayableUri(session.deviceId, session.sessionToken, item)
    }

    private suspend fun waitForVideoEnd(player: ExoPlayer, fallbackSeconds: Int) {
        var ended = false
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) ended = true
            }
        }
        player.addListener(listener)
        try {
            val maxMs = fallbackSeconds.coerceAtLeast(1) * 1000L
            var waited = 0L
            while (!ended && waited < maxMs) {
                delay(250)
                waited += 250
            }
        } finally {
            player.removeListener(listener)
            player.stop()
        }
    }

    private fun reportPlayback(
        item: ManifestItem,
        type: PlaybackEventType,
        error: String? = null,
        cacheStatus: String? = null
    ) {
        val session = activeSession ?: return
        lifecycleScope.launch {
            runCatching {
                gateway.reportPlayback(
                    PlaybackEventRequest(
                        deviceId = session.deviceId,
                        sessionToken = session.sessionToken,
                        eventType = type.name.lowercase(),
                        itemId = item.id,
                        assetId = item.assetId,
                        durationMs = item.durationSeconds * 1000L,
                        cacheStatus = cacheStatus,
                        errorMessage = error
                    )
                )
            }
        }
    }

    private fun setupViews() {
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        playerView = PlayerView(this).apply {
            visibility = View.GONE
            useController = false
        }
        imageView = ImageView(this).apply {
            visibility = View.GONE
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.BLACK)
        }
        webView = WebView(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.BLACK)
        }
        statusText = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 22f
            gravity = Gravity.CENTER
        }
        pairingText = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 42f
            gravity = Gravity.CENTER
            visibility = View.GONE
        }

        root.addView(playerView, matchParams())
        root.addView(imageView, matchParams())
        root.addView(webView, matchParams())
        root.addView(statusText, matchParams())
        root.addView(pairingText, matchParams())
        setContentView(root)
    }

    private fun showPairing(code: String) {
        hideAllSurfaces()
        statusText.visibility = View.GONE
        pairingText.visibility = View.VISIBLE
        pairingText.text = "Pair this screen\n\n$code\n\nEnter this code in the dashboard"
    }

    private fun showStatus(message: String) {
        statusText.visibility = View.VISIBLE
        statusText.text = message
    }

    private fun showFatal(message: String) {
        hideAllSurfaces()
        statusText.visibility = View.VISIBLE
        statusText.text = message
    }

    private fun hideAllSurfaces() {
        playerView.visibility = View.GONE
        imageView.visibility = View.GONE
        webView.visibility = View.GONE
        pairingText.visibility = View.GONE
    }

    private fun setupKioskMode() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                )
        }
    }

    private fun startRuntimeService() {
        val intent = Intent(this, PlayerForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }

    private fun matchParams(): FrameLayout.LayoutParams =
        FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
}
