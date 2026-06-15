package com.nuexis.player

import android.Manifest
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.util.Log
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout
import androidx.lifecycle.lifecycleScope
import com.google.gson.JsonObject
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import com.nuexis.player.playback.CacheManager
import com.nuexis.player.playback.MediaEngine
import com.nuexis.player.playback.PlaylistEngine
import com.nuexis.player.realtime.RealtimeClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import com.google.gson.Gson
import android.view.MotionEvent
import android.os.Handler
import android.os.Looper
import com.google.android.material.button.MaterialButton

class MainActivity : AppCompatActivity(), RealtimeClient.RealtimeListener {

    private lateinit var storageManager: StorageManager
    private lateinit var supabaseClient: SupabaseClient
    private lateinit var cacheManager: CacheManager
    private var mediaEngine: MediaEngine? = null
    private var realtimeClient: RealtimeClient? = null
    private var playlistEngine: PlaylistEngine? = null

    private lateinit var drawerLayout: DrawerLayout
    private lateinit var mainContentContainer: FrameLayout
    private lateinit var sidebarDrawer: View
    private var controlOverlayHideRunnable: Runnable? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val supabaseUrl = "https://dpdabdbqhjkmxvwnukev.supabase.co"
    private val supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZGFiZGJxaGprbXh2d251a2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzMxMTIsImV4cCI6MjA5MzkwOTExMn0.VR0ZMijdHRokIFiXiIZ6rQsKoGtokp8GZh5C-vSvcpI"

    private var countdownJob: Job? = null
    private var statusTrackingJob: Job? = null
    private var currentView: View? = null
    private var currentScaleMode = "Fit"
    private var isImmersive = false
    private var diagnosticsManager: com.nuexis.player.diagnostics.DiagnosticsManager? = null
    private var lastManifestVersion: String? = null
    private var onlineCheckJob: Job? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val STORAGE_PERMISSION_CODE = 1001

    private var lastTeamId: String? = null
    private var lastContentType: String? = null
    private var lastAssetId: String? = null
    private var lastPlaylistId: String? = null
    private var lastOrientation: Int? = null
    private var lastScaleMode: String? = null
    private var lastUpdatedAt: String? = null

    private fun checkAndRequestStoragePermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    AlertDialog.Builder(this)
                        .setTitle("Storage Permission Required")
                        .setMessage("This app needs 'All files access' permission to securely persist the device identity across uninstalls/reinstalls. Please enable it in the next screen.")
                        .setPositiveButton("Allow") { _, _ ->
                            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                                data = Uri.fromParts("package", packageName, null)
                            }
                            startActivity(intent)
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                        startActivity(intent)
                    } catch (ex: Exception) {
                        ex.printStackTrace()
                    }
                }
            }
        } else {
            val permissions = arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
            val neededPermissions = permissions.filter {
                ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
            }
            if (neededPermissions.isNotEmpty()) {
                ActivityCompat.requestPermissions(this, neededPermissions.toTypedArray(), STORAGE_PERMISSION_CODE)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        drawerLayout = findViewById(R.id.drawer_layout)
        mainContentContainer = findViewById(R.id.main_content_container)
        sidebarDrawer = findViewById(R.id.sidebar_drawer)

        drawerLayout.setDrawerLockMode(DrawerLayout.LOCK_MODE_LOCKED_CLOSED)
        drawerLayout.addDrawerListener(object : DrawerLayout.SimpleDrawerListener() {
            override fun onDrawerClosed(drawerView: View) {
                super.onDrawerClosed(drawerView)
                showControlOverlayTemporarily()
            }
            override fun onDrawerOpened(drawerView: View) {
                super.onDrawerOpened(drawerView)
                val overlay = currentView?.findViewById<View>(R.id.control_overlay)
                overlay?.let {
                    it.visibility = View.VISIBLE
                    it.alpha = 1f
                }
                controlOverlayHideRunnable?.let { mainHandler.removeCallbacks(it) }
            }
        })

        storageManager = StorageManager(this)
        supabaseClient = SupabaseClient(supabaseUrl, supabaseAnonKey)
        cacheManager = CacheManager(this, supabaseClient)

        setupSidebar()
        checkAndRequestStoragePermission()
        registerConnectivityListener()
        loadDeviceState()
    }

    private fun setupSidebar() {
        val btnRefresh = findViewById<MaterialButton>(R.id.btn_refresh)
        val btnUnpair = findViewById<MaterialButton>(R.id.btn_unpair)
        val btnMute = findViewById<MaterialButton>(R.id.btn_mute)
        val btnOrientation = findViewById<MaterialButton>(R.id.btn_orientation)
        val btnCloseDrawer = findViewById<View>(R.id.btn_close_drawer)

        btnCloseDrawer?.setOnClickListener {
            drawerLayout.closeDrawer(GravityCompat.START)
        }

        btnRefresh?.setOnClickListener {
            drawerLayout.closeDrawer(GravityCompat.START)
            syncSignageContent()
        }

        btnUnpair?.setOnClickListener {
            drawerLayout.closeDrawer(GravityCompat.START)
            AlertDialog.Builder(this)
                .setTitle("Unpair Screen")
                .setMessage("Are you sure you want to unpair this screen?")
                .setPositiveButton("Yes") { _, _ -> handleUnpair() }
                .setNegativeButton("No", null)
                .show()
        }

        btnMute?.setOnClickListener {
            val nextMute = !storageManager.isMuted()
            storageManager.setMuted(nextMute)
            mediaEngine?.setMuted(nextMute)
            btnMute.text = if (nextMute) "Unmute" else "Mute"
            btnMute.setIconResource(if (nextMute) R.drawable.ic_volume_off else R.drawable.ic_volume)
            drawerLayout.closeDrawer(GravityCompat.START)
        }
        btnMute?.text = if (storageManager.isMuted()) "Unmute" else "Mute"
        btnMute?.setIconResource(if (storageManager.isMuted()) R.drawable.ic_volume_off else R.drawable.ic_volume)

        btnOrientation?.setOnClickListener {
            showOrientationSelector()
        }
        updateOrientationButtonText()
    }

    private fun updateOrientationButtonText() {
        val btnOrientation = findViewById<Button>(R.id.btn_orientation)
        btnOrientation?.text = when (storageManager.getOrientation()) {
            0 -> "0° — Landscape"
            90 -> "90° — Portrait CW"
            180 -> "180° — Landscape Flipped"
            270 -> "270° — Portrait CCW"
            else -> "0° — Landscape"
        }
    }

    private fun showOrientationSelector() {
        val items = arrayOf(
            "0° — Landscape",
            "90° — Portrait CW",
            "180° — Landscape Flipped",
            "270° — Portrait CCW"
        )
        AlertDialog.Builder(this)
            .setTitle("Select Screen Orientation")
            .setItems(items) { _, which ->
                val degrees = when (which) {
                    0 -> 0
                    1 -> 90
                    2 -> 180
                    3 -> 270
                    else -> 0
                }
                lifecycleScope.launch(Dispatchers.IO) {
                    val deviceId = storageManager.getDeviceId()
                    val hardwareId = storageManager.getHardwareId()
                    val secret = storageManager.getSecret()
                    if (deviceId != null && secret != null) {
                        try {
                            supabaseClient.updateDeviceOrientation(deviceId, hardwareId, secret, degrees)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    withContext(Dispatchers.Main) {
                        storageManager.setOrientation(degrees)
                        applyNativeOrientation(degrees)
                        updateOrientationButtonText()
                        drawerLayout.closeDrawer(GravityCompat.START)
                    }
                }
            }
            .show()
    }

    private fun handleUnpair() {
        showLoading()
        lifecycleScope.launch(Dispatchers.IO) {
            val deviceId = storageManager.getDeviceId()
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret()
            if (deviceId != null && secret != null) {
                try {
                    supabaseClient.unpairDevice(deviceId, hardwareId, secret)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            withContext(Dispatchers.Main) {
                realtimeClient?.disconnect()
                realtimeClient = null
                playlistEngine?.stop()
                playlistEngine = null
                diagnosticsManager?.stop()
                diagnosticsManager = null
                onlineCheckJob?.cancel()
                onlineCheckJob = null
                storageManager.setSessionToken(null)
                lastTeamId = null
                lastContentType = null
                lastAssetId = null
                lastPlaylistId = null
                lastOrientation = null
                storageManager.clearAll()
                loadDeviceState()
            }
        }
    }

    private fun loadDeviceState() {
        showLoading()
        lifecycleScope.launch(Dispatchers.IO) {
            val hardwareId = storageManager.getHardwareId()
            var secret = storageManager.getSecret()

            if (secret == null) {
                // Try restoring from the AES encrypted backup file
                if (storageManager.restoreIdentity()) {
                    secret = storageManager.getSecret()
                }
            }

            val result = supabaseClient.getDeviceState(hardwareId, secret)

            withContext(Dispatchers.Main) {
                when (result) {
                    is SupabaseClient.DeviceStateResult.Success -> {
                        val state = result.state
                        if (state != null) {
                            storageManager.setDeviceId(state.id)
                            storageManager.setPairingCode(state.pairing_code)
                            
                            // Set baseline config values to support client-side change-detection
                            lastTeamId = state.team_id
                            lastContentType = state.content_type
                            lastAssetId = state.asset_id
                            lastPlaylistId = state.playlist_id
                            lastOrientation = state.orientation
                            lastScaleMode = state.scale_mode
                            lastUpdatedAt = state.updated_at

                            val expiresAt = try {
                                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                    timeZone = TimeZone.getTimeZone("UTC")
                                }
                                sdf.parse(state.expires_at)?.time ?: (Date().time + 900000)
                            } catch (e: Exception) {
                                Date().time + 900000
                            }
                            storageManager.setExpiresAt(expiresAt)

                            if (!state.team_id.isNullOrEmpty()) {
                                storageManager.setOrientation(state.orientation ?: 0)
                                val baselineScaleMode = state.scale_mode ?: "Fit"
                                storageManager.setScaleMode(baselineScaleMode)
                                currentScaleMode = baselineScaleMode
                                startPairedPlayer(state.team_id, state.id)
                            } else {
                                val timeLeft = expiresAt - Date().time
                                if (timeLeft > 0) {
                                    startPairingFlow(state.id, state.pairing_code, expiresAt)
                                } else {
                                    // Automatically renew the existing pairing code in the background
                                    refreshPairingCode(state.pairing_code)
                                }
                            }
                        } else {
                            // Device deleted from DB or invalid secret
                            registerNewDevice()
                        }
                    }
                    is SupabaseClient.DeviceStateResult.Error -> {
                        Log.e("MainActivity", "Failed to fetch device state: ${result.exception.message}", result.exception)
                        // Offline recovery logic: check if we have any cached content type
                        val cachedContentType = storageManager.getCachedContentType()
                        if (storageManager.getDeviceId() != null && cachedContentType != null) {
                            startOfflinePlaybackFromCache()
                        } else {
                            // Show connection error screen
                            showConnectionError(result.exception.message ?: "Failed to connect to the server.")
                            startOnlineCheckLoop()
                        }
                    }
                }
            }
        }
    }

    private fun registerNewDevice() {
        showLoading()
        lifecycleScope.launch(Dispatchers.IO) {
            val hardwareId = storageManager.getHardwareId()
            val initialCode = generateRandomPairingCode()
            val expiresAt = Date().time + 900000

            try {
                val result = supabaseClient.registerDevice(hardwareId, initialCode, expiresAt)
                withContext(Dispatchers.Main) {
                    storageManager.setDeviceId(result.id)
                    storageManager.setSecret(result.secret)
                    storageManager.setPairingCode(result.pairing_code)
                    storageManager.setExpiresAt(expiresAt)
                    startPairingFlow(result.id, result.pairing_code, expiresAt)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    showErrorToast("Device registration failed: ${e.message}")
                    showExpired()
                }
            }
        }
    }

    private fun refreshPairingCode(codeToKeep: String? = null) {
        showLoading()
        lifecycleScope.launch(Dispatchers.IO) {
            val deviceId = storageManager.getDeviceId() ?: return@launch
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret() ?: return@launch
            val finalCode = codeToKeep ?: generateRandomPairingCode()
            val expiresAt = Date().time + 900000

            try {
                val result = supabaseClient.refreshDeviceCode(deviceId, hardwareId, secret, finalCode, expiresAt)
                withContext(Dispatchers.Main) {
                    storageManager.setPairingCode(finalCode)
                    storageManager.setExpiresAt(expiresAt)
                    startPairingFlow(result.id, finalCode, expiresAt)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    showErrorToast("Code refresh failed: ${e.message}")
                    showExpired()
                }
            }
        }
    }

    private fun startPairingFlow(deviceId: String, code: String, expiresAt: Long) {
        showPairing(code)
        startRealtime(deviceId)

        countdownJob?.cancel()
        countdownJob = lifecycleScope.launch {
            val pbProgress = currentView?.findViewById<ProgressBar>(R.id.pb_pairing_progress)
            val tvCountdown = currentView?.findViewById<TextView>(R.id.tv_countdown)
            val totalDuration = 900000.0

            while (true) {
                val timeLeft = expiresAt - Date().time
                if (timeLeft <= 0) {
                    // Automatically refresh the existing code in the background to extend its expiry
                    refreshPairingCode(code)
                    break
                }

                val mins = timeLeft / 60000
                val secs = (timeLeft % 60000) / 1000
                tvCountdown?.text = String.format(Locale.US, "%02d:%02d", mins, secs)

                val pct = ((timeLeft / totalDuration) * 100).toInt()
                pbProgress?.progress = pct

                delay(1000)
            }
        }
    }

    private fun startPairedPlayer(teamId: String, deviceId: String) {
        countdownJob?.cancel()
        drawerLayout.setDrawerLockMode(DrawerLayout.LOCK_MODE_UNLOCKED)
        applyNativeOrientation(storageManager.getOrientation())
        
        // Auto-enter immersive full screen on paired play
        isImmersive = true
        applyImmersiveMode(true)
        
        showPaired()
        startRealtime(deviceId)
        realtimeClient?.startPresence(teamId)

        val viewport = currentView?.findViewById<FrameLayout>(R.id.content_viewport)
        if (viewport != null) {
            mediaEngine?.release()
            mediaEngine = MediaEngine(this, viewport)
            mediaEngine?.setMuted(storageManager.isMuted())
        }

        // Exchange secret for session and start diagnostics
        exchangeSessionAndStartDiagnostics(teamId, deviceId)


        statusTrackingJob?.cancel()
        statusTrackingJob = lifecycleScope.launch {
            while (true) {
                delay(60000)
                val hardwareId = storageManager.getHardwareId()
                val secret = storageManager.getSecret()
                val sessionToken = storageManager.getSessionToken()
                if (secret != null) {
                    withContext(Dispatchers.IO) {
                        supabaseClient.incrementPlaytime(deviceId, hardwareId, secret, 60)
                        if (sessionToken != null) {
                            supabaseClient.pingDevice(deviceId, sessionToken)
                        }
                    }
                }
            }
        }

        syncSignageContent()
    }

    private fun syncSignageContent() {
        lifecycleScope.launch(Dispatchers.IO) {
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret() ?: return@launch
            val result = supabaseClient.getDeviceState(hardwareId, secret)

            withContext(Dispatchers.Main) {
                when (result) {
                    is SupabaseClient.DeviceStateResult.Success -> {
                        val state = result.state
                        if (state != null) {
                            if (state.orientation != null) {
                                storageManager.setOrientation(state.orientation)
                                applyNativeOrientation(state.orientation)
                                updateOrientationButtonText()
                            }

                            if (state.scale_mode != null) {
                                storageManager.setScaleMode(state.scale_mode)
                                currentScaleMode = state.scale_mode
                            }

                            // Update cached content configuration
                            storageManager.setCachedContentType(state.content_type)
                            lastUpdatedAt = state.updated_at

                            if (state.content_type == "Asset" && !state.asset_id.isNullOrEmpty()) {
                                storageManager.setCachedAssetId(state.asset_id)
                                loadAssetContent(state.asset_id, hardwareId, secret)
                            } else if (state.content_type == "Playlist" && !state.playlist_id.isNullOrEmpty()) {
                                storageManager.setCachedPlaylistId(state.playlist_id)
                                loadPlaylistContent(state.playlist_id, hardwareId, secret)
                            } else {
                                playlistEngine?.stop()
                                mediaEngine?.stopAll()
                            }
                        } else {
                            // Device unlinked or secret invalid
                            handleUnpair()
                        }
                    }
                    is SupabaseClient.DeviceStateResult.Error -> {
                        Log.e("MainActivity", "syncSignageContent failed: ${result.exception.message}", result.exception)
                        showErrorToast("Sync failed: ${result.exception.message}")
                        
                        // Fall back to offline playback if not already playing anything
                        if (mediaEngine == null) {
                            val cachedContentType = storageManager.getCachedContentType()
                            if (cachedContentType != null) {
                                startOfflinePlaybackFromCache()
                            }
                        }
                    }
                }
            }
        }
    }

    private fun loadAssetContent(assetId: String, hardwareId: String, secret: String) {
        playlistEngine?.stop()
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val asset = supabaseClient.getPlayerAsset(assetId, hardwareId, secret)
                if (asset != null) {
                    // Update cache paths
                    storageManager.setCachedAssetFilePath(asset.file_path)
                    storageManager.setCachedAssetMimeType(asset.mime_type)

                    // Handle widgets: they store JSON config in file_path, not a storage path
                    if (asset.mime_type.startsWith("application/x-widget")) {
                        withContext(Dispatchers.Main) {
                            mediaEngine?.playWidget(asset.mime_type, asset.file_path)
                        }
                        return@launch
                    }

                    val file = cacheManager.downloadAsset(asset.file_path, hardwareId, secret)
                    withContext(Dispatchers.Main) {
                        if (asset.mime_type.startsWith("video/")) {
                            mediaEngine?.playVideo(file, currentScaleMode, storageManager.isMuted())
                        } else {
                            mediaEngine?.playImage(file, currentScaleMode)
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                withContext(Dispatchers.Main) {
                    showErrorToast("Failed to load asset online: ${e.message}")
                    // Offline fallback: try to load the last cached asset file
                    val cachedPath = storageManager.getCachedAssetFilePath()
                    val cachedMime = storageManager.getCachedAssetMimeType()
                    if (cachedPath != null && cachedMime != null) {
                        if (cachedMime.startsWith("application/x-widget")) {
                            mediaEngine?.playWidget(cachedMime, cachedPath)
                        } else {
                            val file = cacheManager.getCachedFile(cachedPath)
                            if (file.exists() && file.length() > 0) {
                                if (cachedMime.startsWith("video/")) {
                                    mediaEngine?.playVideo(file, currentScaleMode, storageManager.isMuted())
                                } else {
                                    mediaEngine?.playImage(file, currentScaleMode)
                                }
                            }
                        }
                    }
                }
            }
        }
    }


    private fun loadPlaylistContent(playlistId: String, hardwareId: String, secret: String) {
        if (playlistEngine == null) {
            val media = mediaEngine ?: return
            playlistEngine = PlaylistEngine(this, lifecycleScope, supabaseClient, cacheManager, media, storageManager, diagnosticsManager)
        }
        playlistEngine?.start(playlistId, hardwareId, secret)
        realtimeClient?.startPlaylistSubscription(playlistId)
    }

    private fun startRealtime(deviceId: String) {
        if (realtimeClient != null) return
        val presenceKey = storageManager.getPresenceKey()
        realtimeClient = RealtimeClient(supabaseUrl, supabaseAnonKey, deviceId, presenceKey, this).apply {
            connect()
        }
    }

    private fun applyNativeOrientation(degrees: Int) {
        requestedOrientation = when (degrees) {
            0 -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            90 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            180 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
            270 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
            else -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        }
    }

    private fun generateRandomPairingCode(): String {
        val chars = ('A'..'Z') + ('0'..'9')
        return (1..6).map { chars.random() }.joinToString("")
    }

    private fun showLoading() {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(this).inflate(R.layout.view_loading, mainContentContainer, false)
        mainContentContainer.addView(currentView)
    }

    private fun showPairing(code: String) {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(this).inflate(R.layout.view_pairing, mainContentContainer, false)
        currentView?.findViewById<TextView>(R.id.tv_pairing_code)?.text = code
        mainContentContainer.addView(currentView)
    }

    private fun showExpired() {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(this).inflate(R.layout.view_expired, mainContentContainer, false)
        currentView?.findViewById<Button>(R.id.btn_regenerate)?.setOnClickListener {
            val existingCode = storageManager.getPairingCode()
            refreshPairingCode(existingCode)
        }
        mainContentContainer.addView(currentView)
    }

    private fun showConnectionError(message: String) {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(this).inflate(R.layout.view_connection_error, mainContentContainer, false)
        currentView?.findViewById<TextView>(R.id.tv_error_message)?.text = message
        currentView?.findViewById<Button>(R.id.btn_retry)?.setOnClickListener {
            loadDeviceState()
        }
        mainContentContainer.addView(currentView)
    }

    private fun showPaired() {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(this).inflate(R.layout.view_paired, mainContentContainer, false)
        
        currentView?.findViewById<View>(R.id.btn_menu)?.setOnClickListener {
            drawerLayout.openDrawer(GravityCompat.START)
        }

        currentView?.findViewById<android.widget.ImageButton>(R.id.btn_fullscreen)?.setOnClickListener {
            toggleImmersiveMode()
        }

        // Apply visual state for fullscreen toggle
        val btnFullscreen = currentView?.findViewById<android.widget.ImageButton>(R.id.btn_fullscreen)
        btnFullscreen?.setImageResource(
            if (isImmersive) R.drawable.ic_fullscreen_exit else R.drawable.ic_fullscreen
        )
        applyImmersiveMode(isImmersive)

        mainContentContainer.addView(currentView)
        showControlOverlayTemporarily()
    }

    private fun toggleImmersiveMode() {
        isImmersive = !isImmersive
        applyImmersiveMode(isImmersive)
        
        val btnFullscreen = currentView?.findViewById<android.widget.ImageButton>(R.id.btn_fullscreen)
        btnFullscreen?.setImageResource(
            if (isImmersive) R.drawable.ic_fullscreen_exit else R.drawable.ic_fullscreen
        )
    }

    private fun showControlOverlayTemporarily() {
        val overlay = currentView?.findViewById<View>(R.id.control_overlay) ?: return
        
        controlOverlayHideRunnable?.let { mainHandler.removeCallbacks(it) }
        
        if (overlay.visibility != View.VISIBLE) {
            overlay.alpha = 0f
            overlay.visibility = View.VISIBLE
            overlay.animate().alpha(1f).setDuration(250).start()
        }
        
        if (drawerLayout.isDrawerOpen(GravityCompat.START)) {
            return
        }
        
        val hideRunnable = Runnable {
            overlay.animate().alpha(0f).setDuration(250).withEndAction {
                overlay.visibility = View.GONE
            }.start()
        }
        controlOverlayHideRunnable = hideRunnable
        mainHandler.postDelayed(hideRunnable, 3000)
    }

    override fun dispatchTouchEvent(ev: MotionEvent?): Boolean {
        if (ev?.action == MotionEvent.ACTION_DOWN) {
            showControlOverlayTemporarily()
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun applyImmersiveMode(enable: Boolean) {
        if (enable) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
                window.insetsController?.hide(
                    android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars()
                )
                window.insetsController?.systemBarsBehavior =
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
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
        } else {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(true)
                window.insetsController?.show(
                    android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars()
                )
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                )
            }
        }
    }

    private fun exchangeSessionAndStartDiagnostics(teamId: String, deviceId: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret()
            if (secret != null) {
                try {
                    val sessionResult = supabaseClient.exchangeDeviceSecretForSession(deviceId, hardwareId, secret)
                    withContext(Dispatchers.Main) {
                        storageManager.setSessionToken(sessionResult.session_token)
                        
                        val initialManifestVersion = try {
                            sessionResult.manifest?.getAsJsonObject("manifest")?.get("manifest_version")?.asString
                        } catch (e: Exception) {
                            null
                        }
                        
                        startDiagnostics(initialManifestVersion)
                    }
                } catch (e: Exception) {
                    Log.e("MainActivity", "Session exchange failed: ${e.message}", e)
                }
            }
        }
    }

    private fun startDiagnostics(initialManifestVersion: String? = null) {
        if (diagnosticsManager == null) {
            diagnosticsManager = com.nuexis.player.diagnostics.DiagnosticsManager(
                context = this,
                supabaseClient = supabaseClient,
                storageManager = storageManager,
                coroutineScope = lifecycleScope,
                manifestVersionGetter = { lastManifestVersion },
                currentItemIdGetter = { playlistEngine?.currentItemId }
            )
        }
        diagnosticsManager?.start()
        if (initialManifestVersion != null) {
            lastManifestVersion = initialManifestVersion
        }
    }

    private fun startOfflinePlaybackFromCache() {
        val cachedType = storageManager.getCachedContentType()
        Log.d("MainActivity", "Starting offline playback from cache. Type: $cachedType")
        drawerLayout.setDrawerLockMode(DrawerLayout.LOCK_MODE_UNLOCKED)
        applyNativeOrientation(storageManager.getOrientation())
        
        isImmersive = true
        applyImmersiveMode(true)
        
        showPaired()
        
        val viewport = currentView?.findViewById<FrameLayout>(R.id.content_viewport)
        if (viewport != null) {
            mediaEngine?.release()
            mediaEngine = MediaEngine(this, viewport)
            mediaEngine?.setMuted(storageManager.isMuted())
        }

        if (cachedType == "Asset") {
            val filePath = storageManager.getCachedAssetFilePath()
            val mimeType = storageManager.getCachedAssetMimeType()
            if (filePath != null && mimeType != null) {
                val file = cacheManager.getCachedFile(filePath)
                if (file.exists() && file.length() > 0) {
                    if (mimeType.startsWith("video/")) {
                        mediaEngine?.playVideo(file, currentScaleMode, storageManager.isMuted())
                    } else {
                        mediaEngine?.playImage(file, currentScaleMode)
                    }
                } else {
                    showErrorToast("Cached asset file not found locally.")
                }
            } else {
                showErrorToast("No cached asset configuration found.")
            }
        } else if (cachedType == "Playlist") {
            val cachedManifest = storageManager.getCachedManifest()
            if (!cachedManifest.isNullOrEmpty()) {
                if (playlistEngine == null) {
                    val media = mediaEngine ?: return
                    playlistEngine = PlaylistEngine(this, lifecycleScope, supabaseClient, cacheManager, media, storageManager, diagnosticsManager)
                }
                playlistEngine?.startOffline(cachedManifest)
            } else {
                showErrorToast("No cached playlist manifest found.")
            }
        }
        
        startOnlineCheckLoop()
    }

    private fun startOnlineCheckLoop() {
        onlineCheckJob?.cancel()
        onlineCheckJob = lifecycleScope.launch(Dispatchers.IO) {
            while (true) {
                delay(30000)
                Log.d("MainActivity", "Checking online status...")
                val hardwareId = storageManager.getHardwareId()
                val secret = storageManager.getSecret()
                val result = supabaseClient.getDeviceState(hardwareId, secret)
                if (result is SupabaseClient.DeviceStateResult.Success && result.state != null) {
                    Log.d("MainActivity", "Device is back online. Reloading online player state.")
                    withContext(Dispatchers.Main) {
                        onlineCheckJob?.cancel()
                        onlineCheckJob = null
                        loadDeviceState()
                    }
                    break
                }
            }
        }
    }

    private fun showErrorToast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
    }

    // Realtime Events
    override fun onDeviceUpdated(record: JsonObject) {
        lifecycleScope.launch(Dispatchers.Main) {
            val teamId = record.get("team_id")?.let { if (it.isJsonNull) null else it.asString }
            val contentType = record.get("content_type")?.let { if (it.isJsonNull) null else it.asString }
            val assetId = record.get("asset_id")?.let { if (it.isJsonNull) null else it.asString }
            val playlistId = record.get("playlist_id")?.let { if (it.isJsonNull) null else it.asString }
            val orientation = record.get("orientation")?.let { if (it.isJsonNull) null else it.asInt }
            val scaleMode = record.get("scale_mode")?.let { if (it.isJsonNull) null else it.asString }
            val updatedAt = record.get("updated_at")?.let { if (it.isJsonNull) null else it.asString }

            val changed = teamId != lastTeamId ||
                    orientation != lastOrientation ||
                    contentType != lastContentType ||
                    assetId != lastAssetId ||
                    playlistId != lastPlaylistId ||
                    scaleMode != lastScaleMode ||
                    updatedAt != lastUpdatedAt

            if (!changed) {
                // Ignore status updates, last_seen_at updates, or heartbeat updates to save HTTP load
                return@launch
            }

            // Update tracked values
            lastTeamId = teamId
            lastOrientation = orientation
            lastContentType = contentType
            lastAssetId = assetId
            lastPlaylistId = playlistId
            lastScaleMode = scaleMode
            lastUpdatedAt = updatedAt

            if (teamId != null) {
                // Device paired or orientation updated
                val currentSecret = storageManager.getSecret()
                if (currentSecret != null) {
                    val freshResult = withContext(Dispatchers.IO) {
                        supabaseClient.getDeviceState(storageManager.getHardwareId(), currentSecret)
                    }
                    when (freshResult) {
                        is SupabaseClient.DeviceStateResult.Success -> {
                            val freshState = freshResult.state
                            if (freshState != null) {
                                if (drawerLayout.getDrawerLockMode(GravityCompat.START) == DrawerLayout.LOCK_MODE_LOCKED_CLOSED) {
                                    startPairedPlayer(teamId, freshState.id)
                                } else {
                                    syncSignageContent()
                                }
                            }
                        }
                        is SupabaseClient.DeviceStateResult.Error -> {
                            Log.e("MainActivity", "onDeviceUpdated state fetch failed: ${freshResult.exception.message}")
                        }
                    }
                }
            } else {
                // Device unpaired from CMS
                handleUnpair()
            }
        }
    }

    override fun onDeviceDeleted() {
        lifecycleScope.launch(Dispatchers.Main) {
            handleUnpair()
        }
    }

    override fun onPlaylistRefresh() {
        lifecycleScope.launch(Dispatchers.Main) {
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret()
            val playlistId = lastPlaylistId
            if (secret != null && playlistId != null) {
                playlistEngine?.start(playlistId, hardwareId, secret)
            }
        }
    }

    override fun onConnected() {}
    override fun onDisconnected() {}
    override fun onError(t: Throwable) {
        t.printStackTrace()
    }

    override fun onScreenshotRequested(backendUrl: String?) {
        lifecycleScope.launch(Dispatchers.Main) {
            Log.d("MainActivity", "Screenshot requested from CMS, backendUrl: $backendUrl")
            try {
                val rootView = window.decorView.rootView
                val width = rootView.width
                val height = rootView.height
                if (width <= 0 || height <= 0) return@launch

                val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(bitmap)
                rootView.draw(canvas)

                val byteArrayOutputStream = java.io.ByteArrayOutputStream()
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 80, byteArrayOutputStream)
                val byteArray = byteArrayOutputStream.toByteArray()
                val base64Data = android.util.Base64.encodeToString(byteArray, android.util.Base64.DEFAULT)

                withContext(Dispatchers.IO) {
                    val deviceId = storageManager.getDeviceId() ?: return@withContext
                    val hardwareId = storageManager.getHardwareId()
                    val secret = storageManager.getSecret() ?: return@withContext

                    val payload = JsonObject().apply {
                        addProperty("deviceId", deviceId)
                        addProperty("hardwareId", hardwareId)
                        addProperty("secret", secret)
                        addProperty("base64Data", base64Data)
                    }

                    val baseUrl = if (!backendUrl.isNullOrEmpty()) {
                        backendUrl
                    } else {
                        supabaseUrl
                    }
                    val url = if (baseUrl.endsWith("/")) "${baseUrl}api/player/screenshot" else "$baseUrl/api/player/screenshot"

                    val requestBody = Gson().toJson(payload).toRequestBody("application/json; charset=utf-8".toMediaType())
                    val request = Request.Builder()
                        .url(url)
                        .post(requestBody)
                        .build()

                    OkHttpClient().newCall(request).execute().use { response ->
                        if (!response.isSuccessful) {
                            Log.e("MainActivity", "Screenshot upload failed: ${response.code} ${response.body?.string()}")
                        } else {
                            Log.d("MainActivity", "Screenshot uploaded successfully")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Failed to capture or upload screenshot", e)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        Log.d("MainActivity", "onResume: Checking realtime client connection status.")
        val deviceId = storageManager.getDeviceId()
        val teamId = lastTeamId
        if (deviceId != null && teamId != null) {
            val client = realtimeClient
            if (client == null) {
                startRealtime(deviceId)
            } else {
                if (!client.isConnected()) {
                    Log.d("MainActivity", "realtimeClient is disconnected in onResume. Reconnecting.")
                    client.connect()
                } else {
                    Log.d("MainActivity", "realtimeClient is active. Refreshing presence track.")
                    client.refreshPresence()
                }
            }
        }
    }

    private fun registerConnectivityListener() {
        try {
            val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val networkRequest = android.net.NetworkRequest.Builder()
                .addCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) {
                    Log.d("MainActivity", "Network callback: onAvailable. Reconnecting realtime client if disconnected.")
                    lifecycleScope.launch(Dispatchers.Main) {
                        val deviceId = storageManager.getDeviceId()
                        val teamId = lastTeamId
                        if (deviceId != null && teamId != null) {
                            val client = realtimeClient
                            if (client == null) {
                                startRealtime(deviceId)
                            } else {
                                if (!client.isConnected()) {
                                    client.connect()
                                } else {
                                    client.refreshPresence()
                                }
                            }
                        }
                    }
                }
            }
            connectivityManager.registerNetworkCallback(networkRequest, networkCallback!!)
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to register network callback: ${e.message}", e)
        }
    }

    private fun unregisterConnectivityListener() {
        try {
            val callback = networkCallback
            if (callback != null) {
                val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                connectivityManager.unregisterNetworkCallback(callback)
                networkCallback = null
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to unregister network callback: ${e.message}", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterConnectivityListener()
        realtimeClient?.disconnect()
        playlistEngine?.stop()
        playlistEngine = null
        diagnosticsManager?.stop()
        diagnosticsManager = null
        onlineCheckJob?.cancel()
        onlineCheckJob = null
        mediaEngine?.release()
        countdownJob?.cancel()
        statusTrackingJob?.cancel()
    }
}
