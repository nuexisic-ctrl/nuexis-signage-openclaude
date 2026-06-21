package com.nuexis.player.sync

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.nuexis.player.cache.CacheStore
import com.nuexis.player.cache.DownloadQueue
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import com.nuexis.player.data.SupabaseClient.PlayerManifest
import com.nuexis.player.playback.PlaylistEngine
import com.nuexis.player.state.CacheStatus
import com.nuexis.player.state.PlayerStateHolder
import com.nuexis.player.cache.IntegrityChecker
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.io.IOException

class ManifestCoordinator(
    private val context: Context,
    private val supabaseClient: SupabaseClient,
    private val storageManager: StorageManager,
    private val cacheStore: CacheStore,
    private val downloadQueue: DownloadQueue,
    private val playlistEngine: PlaylistEngine,
    private val onDeviceUnpaired: () -> Unit,
    private val onOrientationChanged: (Int) -> Unit,
    private val onManifestPromoted: (PlayerManifest) -> Unit
) {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val gson = Gson()
    private val syncMutex = Mutex()
    
    private var debounceJob: Job? = null
    private var stagedManifest: PlayerManifest? = null
    
    init {
        // Observe cache progress to promote staged manifest when download queue finishes
        scope.launch {
            PlayerStateHolder.state.collectLatest { state ->
                if (state.cacheStatus == CacheStatus.READY) {
                    promoteStagedIfNeeded()
                }
            }
        }
    }

    fun sync(trigger: SyncTrigger) {
        Log.d("ManifestCoordinator", "Sync triggered by $trigger")
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(500) // 500ms debounce coalescing window
            performSync()
        }
    }

    private suspend fun performSync() {
        syncMutex.withLock {
            val deviceId = storageManager.getDeviceId() ?: return@withLock
            val sessionToken = storageManager.getSessionToken() ?: return@withLock
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret() ?: return@withLock

            try {
                Log.d("ManifestCoordinator", "Fetching player manifest from server...")
                val result = supabaseClient.getPlayerManifest(deviceId, sessionToken)
                
                withContext(Dispatchers.Main) {
                    when (result) {
                        is SupabaseClient.ManifestResult.Success -> {
                            val manifest = result.manifest
                            handleNewManifest(manifest, hardwareId, secret)
                        }
                        is SupabaseClient.ManifestResult.Error -> {
                            Log.e("ManifestCoordinator", "Failed to fetch manifest", result.exception)
                            // If it's an unauthorized exception, trigger unpair
                            if (result.exception.message?.contains("Unauthorized", ignoreCase = true) == true) {
                                onDeviceUnpaired()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("ManifestCoordinator", "Error during performSync", e)
            }
        }
    }

    private suspend fun handleNewManifest(manifest: PlayerManifest, hardwareId: String, secret: String) {
        val currentVersion = storageManager.getManifestVersion()
        
        // Handle orientation changes instantly
        if (manifest.orientation != storageManager.getOrientation()) {
            storageManager.setOrientation(manifest.orientation)
            onOrientationChanged(manifest.orientation)
        }

        if (manifest.manifest_version == currentVersion && playlistEngine.isPlaying) {
            Log.d("ManifestCoordinator", "Manifest version is current (${manifest.manifest_version}). Skipping reload.")
            return
        }

        Log.d("ManifestCoordinator", "New manifest version: ${manifest.manifest_version} (Current: $currentVersion)")
        
        // Write to staged.json
        stagedManifest = manifest
        val stagedFile = File(cacheStore.manifestsDir, "staged.json")
        try {
            stagedFile.writeText(gson.toJson(manifest))
        } catch (e: Exception) {
            Log.e("ManifestCoordinator", "Failed to write staged.json", e)
        }

        // Diff and enqueue downloads
        val activeKeys = manifest.playlist
            .filter { it.asset != null && !it.type.lowercase().startsWith("widget") }
            .map { cacheStore.deriveKey(it.asset!!.file_path) }
            .toSet()

        val missingAssets = manifest.playlist.filter { item ->
            val asset = item.asset
            if (asset == null || item.type.lowercase().startsWith("widget")) {
                false
            } else {
                val key = cacheStore.deriveKey(asset.file_path)
                val cachedFile = cacheStore.getCachedFile(key, "", asset.size_bytes ?: 0L)
                cachedFile == null
            }
        }

        if (missingAssets.isEmpty()) {
            Log.d("ManifestCoordinator", "All assets are already cached. Promoting immediately.")
            promoteStaged(manifest, activeKeys)
        } else {
            Log.d("ManifestCoordinator", "Enqueueing ${missingAssets.size} missing assets to DownloadQueue...")
            
            // Enqueue missing assets with priority based on sort_order
            for (item in missingAssets) {
                val asset = item.asset!!
                downloadQueue.enqueue(
                    assetId = asset.id,
                    filePath = asset.file_path,
                    expectedSize = asset.size_bytes ?: 0L,
                    expectedSha256 = "",
                    priority = 1000 - item.sort_order // Higher priority for earlier items
                )
            }
            
            // Trigger download queue processing
            downloadQueue.startWorkerIfNeeded()
        }
    }

    private suspend fun promoteStagedIfNeeded() {
        val manifest = stagedManifest ?: return
        
        val activeKeys = manifest.playlist
            .filter { it.asset != null && !it.type.lowercase().startsWith("widget") }
            .map { cacheStore.deriveKey(it.asset!!.file_path) }
            .toSet()

        // Double check all assets are downloaded
        val stillMissing = manifest.playlist.any { item ->
            val asset = item.asset
            if (asset == null || item.type.lowercase().startsWith("widget")) {
                false
            } else {
                val key = cacheStore.deriveKey(asset.file_path)
                val file = cacheStore.getFileForGeneration(key, "staged")
                !file.exists() || !IntegrityChecker.validate(file, asset.size_bytes ?: 0L, "")
            }
        }

        if (!stillMissing) {
            promoteStaged(manifest, activeKeys)
        } else {
            Log.w("ManifestCoordinator", "READY status received but some staged assets are still missing/invalid.")
        }
    }

    private suspend fun promoteStaged(manifest: PlayerManifest, activeKeys: Set<String>) {
        Log.d("ManifestCoordinator", "Promoting staged manifest to live: ${manifest.manifest_version}")
        
        // Promote staged files to live in cacheStore
        cacheStore.promoteStaged(manifest.manifest_version, activeKeys)
        
        // Move staged.json to live.json
        val stagedFile = File(cacheStore.manifestsDir, "staged.json")
        val liveFile = File(cacheStore.manifestsDir, "live.json")
        if (stagedFile.exists()) {
            if (!stagedFile.renameTo(liveFile)) {
                Log.e("ManifestCoordinator", "Failed to rename staged.json to live.json")
            }
        }

        stagedManifest = null

        withContext(Dispatchers.Main) {
            storageManager.setManifestVersion(manifest.manifest_version)
            storageManager.setCachedPlaylistId(manifest.assignment?.playlist_id)
            storageManager.setCachedContentType(manifest.content_type)
            storageManager.setCachedManifest(gson.toJson(manifest))

            onManifestPromoted(manifest)

            // Start playlist playback
            playlistEngine.start(manifest)
            Log.d("ManifestCoordinator", "Playback started with manifest version: ${manifest.manifest_version}")
        }
    }

    fun loadLocalLiveManifest() {
        scope.launch {
            val liveFile = File(cacheStore.manifestsDir, "live.json")
            if (liveFile.exists()) {
                try {
                    val json = liveFile.readText()
                    val manifest = gson.fromJson(json, PlayerManifest::class.java)
                    withContext(Dispatchers.Main) {
                        onManifestPromoted(manifest)
                        playlistEngine.start(manifest)
                    }
                } catch (e: Exception) {
                    Log.e("ManifestCoordinator", "Failed to load local live.json", e)
                }
            }
        }
    }

    fun release() {
        scope.cancel()
        debounceJob?.cancel()
    }
}
