package com.nuexis.player.core.domain.repository

import com.nuexis.player.core.domain.model.Asset
import com.nuexis.player.core.domain.model.Device
import com.nuexis.player.core.domain.model.Playlist
import kotlinx.coroutines.flow.Flow

// Repository definitions for the domain layer
interface DeviceRepository {
    suspend fun getHardwareId(): String
    suspend fun getSecret(): String?
    suspend fun saveSecret(secret: String)
    suspend fun registerDevice(hardwareId: String, pairingCode: String, expiresAtMs: Long): Device
    suspend fun refreshPairingCode(deviceId: String, hardwareId: String, secret: String, pairingCode: String, expiresAtMs: Long): Device
    suspend fun getDeviceState(hardwareId: String, secret: String?): Device?
    fun observeLocalDeviceState(): Flow<Device?>
    suspend fun updateLocalDeviceState(device: Device)
    suspend fun incrementPlaytime(deviceId: String, hardwareId: String, secret: String, seconds: Long)
    suspend fun syncSingleAsset(assetId: String)
    suspend fun unpairDevice(deviceId: String, hardwareId: String, secret: String)
    suspend fun updateOrientation(deviceId: String, hardwareId: String, secret: String, orientation: Int)
    suspend fun clearLocalDeviceData()
}

interface PlaylistRepository {
    suspend fun getPlaylistItems(playlistId: String): Playlist
    fun observeLocalPlaylist(playlistId: String): Flow<Playlist?>
    suspend fun syncPlaylist(playlistId: String)
}

interface AssetRepository {
    suspend fun getSignedMediaUrl(filePath: String, hardwareId: String, secret: String): String
    fun observePendingDownloads(): Flow<List<Asset>>
    suspend fun updateAssetStatus(assetId: String, status: com.nuexis.player.core.domain.model.DownloadStatus, localUri: String? = null)
    suspend fun cleanupUnusedAssets(activeAssetIds: List<String>)
    suspend fun resetFailedDownloads()
}

interface SyncRepository {
    suspend fun syncDeviceState()
}
