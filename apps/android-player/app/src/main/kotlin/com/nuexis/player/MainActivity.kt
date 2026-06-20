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
import android.view.View
import android.util.Log
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
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
import com.nuexis.player.realtime.RealtimeClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.view.MotionEvent
import com.google.android.material.button.MaterialButton

class MainActivity : AppCompatActivity(), RealtimeClient.RealtimeListener, ContentSyncListener {

    lateinit var storageManager: StorageManager
    lateinit var supabaseClient: SupabaseClient
    lateinit var cacheManager: CacheManager
    lateinit var pairingManager: PairingManager
    lateinit var contentSyncManager: ContentSyncManager
    lateinit var uiManager: PlayerUIManager
    private var realtimeClient: RealtimeClient? = null

    private lateinit var drawerLayout: DrawerLayout
    private lateinit var mainContentContainer: FrameLayout
    private lateinit var sidebarDrawer: View

    private val supabaseUrl = BuildConfig.SUPABASE_URL
    private val supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY
    private val permanentExpiry = 253402300799000L // 9999-12-31 23:59:59 UTC

    private var diagnosticsManager: com.nuexis.player.diagnostics.DiagnosticsManager? = null
    private var lastManifestVersion: String? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

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
                uiManager.showControlOverlayTemporarily()
            }
            override fun onDrawerOpened(drawerView: View) {
                super.onDrawerOpened(drawerView)
                val overlay = uiManager.currentView?.findViewById<View>(R.id.control_overlay)
                overlay?.let {
                    it.visibility = View.VISIBLE
                    it.alpha = 1f
                }
            }
        })

        storageManager = StorageManager(this)
        supabaseClient = SupabaseClient(supabaseUrl, supabaseAnonKey)
        cacheManager = CacheManager(this, supabaseClient)
        pairingManager = PairingManager(this, supabaseClient, storageManager, lifecycleScope)
        contentSyncManager = ContentSyncManager(this, supabaseClient, storageManager, cacheManager, lifecycleScope, this)
        uiManager = PlayerUIManager(this, drawerLayout, mainContentContainer)

        uiManager.setupSidebar()
        uiManager.checkAndRequestStoragePermission()
        registerConnectivityListener()
        loadDeviceState()
    }

    override fun updateOrientationButtonText() {
        uiManager.updateOrientationButtonText()
    }

    fun handleUnpair() {
        uiManager.showLoading()
        contentSyncManager.flushPlaytime(async = false)
        pairingManager.handleUnpair {
            realtimeClient?.disconnect()
            realtimeClient = null
            contentSyncManager.release()
            diagnosticsManager?.stop()
            diagnosticsManager = null
            contentSyncManager.clearState()
            loadDeviceState()
        }
    }

    private fun loadDeviceState() {
        uiManager.showLoading()
        lifecycleScope.launch(Dispatchers.IO) {
            val hardwareId = storageManager.getHardwareId()
            var secret = storageManager.getSecret()

            if (secret == null) {
                if (storageManager.restoreIdentity()) {
                    secret = storageManager.getSecret()
                }
            }

            if (secret == null) {
                withContext(Dispatchers.Main) {
                    registerNewDevice()
                }
                return@launch
            }

            val result = supabaseClient.getDeviceState(hardwareId, secret, contentSyncManager.getAppVersion(), contentSyncManager.getOsVersion())

            withContext(Dispatchers.Main) {
                when (result) {
                    is SupabaseClient.DeviceStateResult.Success -> {
                        val state = result.state
                        if (state != null) {
                            storageManager.setDeviceId(state.id)
                            
                            if (!state.team_id.isNullOrEmpty()) {
                                storageManager.setPairingCode(null)
                                storageManager.setOrientation(state.orientation ?: 0)
                                storageManager.setScaleMode(state.scale_mode ?: "Fit")
                                startPairedPlayer(state.team_id, state.id)
                            } else {
                                storageManager.setPairingCode(state.pairing_code)
                                storageManager.setExpiresAt(permanentExpiry)
                                startPairingFlow(state.id, state.pairing_code, permanentExpiry)
                            }
                        } else {
                            registerNewDevice()
                        }
                    }
                    is SupabaseClient.DeviceStateResult.Error -> {
                        Log.e("MainActivity", "Failed to fetch device state: ${result.exception.message}", result.exception)
                        val cachedContentType = storageManager.getCachedContentType()
                        if (storageManager.getDeviceId() != null && cachedContentType != null) {
                            contentSyncManager.startOfflinePlaybackFromCache()
                        } else {
                            showConnectionError(result.exception.message ?: "Failed to connect to the server.")
                            contentSyncManager.startOnlineCheckLoop()
                        }
                    }
                }
            }
        }
    }

    private fun registerNewDevice() {
        uiManager.showLoading()
        pairingManager.registerNewDevice(
            onSuccess = { deviceId, pairingCode, expiresAt ->
                startPairingFlow(deviceId, pairingCode, expiresAt)
            },
            onFailure = { exception ->
                showErrorToast("Device registration failed: ${exception.message}")
                uiManager.showExpired {
                    val existingCode = storageManager.getPairingCode()
                    refreshPairingCode(existingCode)
                }
            }
        )
    }

    private fun refreshPairingCode(codeToKeep: String? = null) {
        uiManager.showLoading()
        pairingManager.refreshPairingCode(
            codeToKeep = codeToKeep,
            onSuccess = { deviceId, pairingCode, expiresAt ->
                startPairingFlow(deviceId, pairingCode, expiresAt)
            },
            onFailure = { exception ->
                showErrorToast("Code refresh failed: ${exception.message}")
                uiManager.showExpired {
                    val existingCode = storageManager.getPairingCode()
                    refreshPairingCode(existingCode)
                }
            }
        )
    }

    private fun startPairingFlow(deviceId: String, code: String, expiresAt: Long) {
        uiManager.showPairing(code)
        startRealtime(deviceId)
    }

    private fun startPairedPlayer(teamId: String, deviceId: String) {
        onPreparePlayerUI()
        
        startRealtime(deviceId)
        realtimeClient?.startPresence(teamId)

        // Ensure we subscribe to playlist changes immediately if a playlist was already cached
        val cachedPlaylistId = storageManager.getCachedPlaylistId()
        val cachedContentType = storageManager.getCachedContentType()
        if (cachedContentType == "Playlist" && !cachedPlaylistId.isNullOrEmpty()) {
            realtimeClient?.startPlaylistSubscription(cachedPlaylistId)
        }

        val viewport = getViewport()
        if (viewport != null) {
            contentSyncManager.initMediaEngine(viewport)
        }

        exchangeSessionAndStartDiagnostics(teamId, deviceId)

        contentSyncManager.startStatusTracking(deviceId)

        contentSyncManager.syncSignageContent()
    }

    override fun getViewport(): FrameLayout? {
        return uiManager.currentView?.findViewById(R.id.content_viewport)
    }

    override fun getDiagnosticsManager(): com.nuexis.player.diagnostics.DiagnosticsManager? {
        return diagnosticsManager
    }

    override fun showErrorToast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
    }

    override fun onPreparePlayerUI() {
        drawerLayout.setDrawerLockMode(DrawerLayout.LOCK_MODE_UNLOCKED)
        applyNativeOrientation(storageManager.getOrientation())
        uiManager.isImmersive = true
        uiManager.applyImmersiveMode(true)
        showPaired()
    }

    override fun onOnlineRestored() {
        loadDeviceState()
    }

    override fun onDeviceUnpaired() {
        handleUnpair()
    }

    override fun onPlaylistIdChanged(playlistId: String?) {
        if (playlistId != null) {
            Log.d("MainActivity", "Subscribing to playlist updates: $playlistId")
            realtimeClient?.startPlaylistSubscription(playlistId)
        } else {
            Log.d("MainActivity", "Stopping playlist subscription")
            realtimeClient?.stopPlaylistSubscription()
        }
    }

    private fun startRealtime(deviceId: String) {
        if (realtimeClient != null) return
        val presenceKey = storageManager.getPresenceKey()
        realtimeClient = RealtimeClient(supabaseUrl, supabaseAnonKey, deviceId, presenceKey, this).apply {
            connect()
        }
    }

    override fun applyNativeOrientation(degrees: Int) {
        requestedOrientation = when (degrees) {
            0 -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            90 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            180 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
            270 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
            else -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        }
    }

    fun showConnectionError(message: String) {
        uiManager.showConnectionError(message) {
            loadDeviceState()
        }
    }

    fun showPaired() {
        uiManager.showPaired(
            onMenuClick = { drawerLayout.openDrawer(GravityCompat.START) },
            onFullscreenClick = { uiManager.toggleImmersiveMode() }
        )
    }

    override fun dispatchTouchEvent(ev: MotionEvent?): Boolean {
        if (ev?.action == MotionEvent.ACTION_DOWN) {
            uiManager.showControlOverlayTemporarily()
        }
        return super.dispatchTouchEvent(ev)
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
                currentItemIdGetter = { contentSyncManager.playlistEngine?.currentItemId }
            )
        }
        diagnosticsManager?.start()
        if (initialManifestVersion != null) {
            lastManifestVersion = initialManifestVersion
        }
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

            val changed = teamId != contentSyncManager.lastTeamId ||
                    orientation != contentSyncManager.lastOrientation ||
                    contentType != contentSyncManager.lastContentType ||
                    assetId != contentSyncManager.lastAssetId ||
                    playlistId != contentSyncManager.lastPlaylistId ||
                    scaleMode != contentSyncManager.lastScaleMode ||
                    updatedAt != contentSyncManager.lastUpdatedAt

            if (!changed) {
                return@launch
            }

            if (teamId != null) {
                val currentSecret = storageManager.getSecret()
                if (currentSecret != null) {
                    if (contentType != null) {
                        val freshState = try {
                            val recordDeviceId = record.get("id")?.let { if (it.isJsonNull) "" else it.asString } ?: ""
                            val pairingCode = record.get("pairing_code")?.let { if (it.isJsonNull) "" else it.asString } ?: ""
                            val expiresAt = record.get("expires_at")?.let { if (it.isJsonNull) "" else it.asString } ?: ""
                            val status = record.get("status")?.let { if (it.isJsonNull) "" else it.asString } ?: ""
                            SupabaseClient.DeviceState(
                                id = recordDeviceId,
                                team_id = teamId,
                                name = record.get("name")?.let { if (it.isJsonNull) null else it.asString },
                                pairing_code = pairingCode,
                                expires_at = expiresAt,
                                status = status,
                                content_type = contentType,
                                asset_id = assetId,
                                playlist_id = playlistId,
                                orientation = orientation,
                                scale_mode = scaleMode,
                                updated_at = updatedAt
                            )
                        } catch (e: Exception) {
                            null
                        }
                        if (freshState != null) {
                            if (drawerLayout.getDrawerLockMode(GravityCompat.START) == DrawerLayout.LOCK_MODE_LOCKED_CLOSED) {
                                startPairedPlayer(teamId, freshState.id)
                            } else {
                                contentSyncManager.syncSignageContent(forceReload = true, preFetchedState = freshState)
                            }
                        } else {
                            fetchAndApplyDeviceState(teamId, currentSecret)
                        }
                    } else {
                        fetchAndApplyDeviceState(teamId, currentSecret)
                    }
                }
            } else {
                handleUnpair()
            }
        }
    }

    private fun fetchAndApplyDeviceState(teamId: String, currentSecret: String) {
        lifecycleScope.launch(Dispatchers.Main) {
            val freshResult = withContext(Dispatchers.IO) {
                supabaseClient.getDeviceState(storageManager.getHardwareId(), currentSecret, contentSyncManager.getAppVersion(), contentSyncManager.getOsVersion())
            }
            when (freshResult) {
                is SupabaseClient.DeviceStateResult.Success -> {
                    val freshState = freshResult.state
                    if (freshState != null) {
                        if (drawerLayout.getDrawerLockMode(GravityCompat.START) == DrawerLayout.LOCK_MODE_LOCKED_CLOSED) {
                            startPairedPlayer(teamId, freshState.id)
                        } else {
                            contentSyncManager.syncSignageContent(forceReload = true, preFetchedState = freshState)
                        }
                    }
                }
                is SupabaseClient.DeviceStateResult.Error -> {
                    Log.e("MainActivity", "onDeviceUpdated state fetch failed: ${freshResult.exception.message}")
                }
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
            val playlistId = contentSyncManager.lastPlaylistId
            if (secret != null && playlistId != null) {
                contentSyncManager.loadPlaylistContent(playlistId, hardwareId, secret)
            }
        }
    }

    override fun onConnected() {
        lifecycleScope.launch(Dispatchers.Main) {
            Log.d("MainActivity", "onConnected: Realtime client connected.")
            if (contentSyncManager.isOnlineChecking()) {
                Log.d("MainActivity", "onConnected: Device is playing offline and network restored. Transitioning online immediately.")
                contentSyncManager.cancelOnlineCheck()
                loadDeviceState()
            } else {
                Log.d("MainActivity", "onConnected: Syncing signage content.")
                contentSyncManager.syncSignageContent(forceReload = false)
            }
        }
    }
    override fun onDisconnected() {}
    override fun onError(t: Throwable) {
        t.printStackTrace()
    }

    override fun onScreenshotRequested(backendUrl: String?) {
        lifecycleScope.launch(Dispatchers.Main) {
            Log.d("MainActivity", "Screenshot requested from CMS, backendUrl: $backendUrl")
            withContext(Dispatchers.IO) {
                ScreenshotHelper.captureAndUpload(this@MainActivity, storageManager, supabaseUrl, backendUrl)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        Log.d("MainActivity", "onResume: Checking realtime client connection status.")
        val deviceId = storageManager.getDeviceId()
        val teamId = contentSyncManager.lastTeamId
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
                        val teamId = contentSyncManager.lastTeamId
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
        contentSyncManager.flushPlaytime(async = false)
        unregisterConnectivityListener()
        realtimeClient?.disconnect()
        contentSyncManager.release()
        diagnosticsManager?.stop()
        diagnosticsManager = null
    }
}
