package com.nuexis.player.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class CacheStatus {
    IDLE,
    DOWNLOADING,
    READY,
    VALIDATING,
    FAILED,
    DISK_FULL
}

data class PlayerState(
    // Cache status fields
    val cacheTotalAssets: Int = 0,
    val cacheDownloadedAssets: Int = 0,
    val cacheRemainingAssets: Int = 0,
    val cachePercent: Int = 0,
    val cacheCurrentAssetName: String = "",
    val cacheStatus: CacheStatus = CacheStatus.IDLE,

    // Network status fields
    val networkOnline: Boolean = false,
    val networkRealtimeConnected: Boolean = false,
    val networkLastServerContact: Long = 0L, // Timestamp in milliseconds
    val networkReconnecting: Boolean = false,

    // Device information fields
    val deviceLocalIp: String = "Unknown",
    val deviceNetworkType: String = "None",
    val deviceLastSyncAt: Long = 0L, // Timestamp in milliseconds
    val deviceStorageUsedBytes: Long = 0L,
    val deviceCacheUsedBytes: Long = 0L,
    val deviceStorageAvailableBytes: Long = 0L
)

object PlayerStateHolder {
    private val _state = MutableStateFlow(PlayerState())
    val state: StateFlow<PlayerState> = _state.asStateFlow()

    fun update(transform: (PlayerState) -> PlayerState) {
        _state.update(transform)
    }

    fun updateCacheProgress(
        total: Int,
        downloaded: Int,
        remaining: Int,
        percent: Int,
        currentAssetName: String,
        status: CacheStatus
    ) {
        _state.update {
            it.copy(
                cacheTotalAssets = total,
                cacheDownloadedAssets = downloaded,
                cacheRemainingAssets = remaining,
                cachePercent = percent,
                cacheCurrentAssetName = currentAssetName,
                cacheStatus = status
            )
        }
    }

    fun updateNetworkStatus(
        online: Boolean,
        realtimeConnected: Boolean,
        lastServerContact: Long = System.currentTimeMillis(),
        reconnecting: Boolean = false
    ) {
        _state.update {
            it.copy(
                networkOnline = online,
                networkRealtimeConnected = realtimeConnected,
                networkLastServerContact = lastServerContact,
                networkReconnecting = reconnecting
            )
        }
    }

    fun updateDeviceInfo(
        localIp: String,
        networkType: String,
        lastSyncAt: Long,
        storageUsed: Long,
        cacheUsed: Long,
        storageAvailable: Long
    ) {
        _state.update {
            it.copy(
                deviceLocalIp = localIp,
                deviceNetworkType = networkType,
                deviceLastSyncAt = lastSyncAt,
                deviceStorageUsedBytes = storageUsed,
                deviceCacheUsedBytes = cacheUsed,
                deviceStorageAvailableBytes = storageAvailable
            )
        }
    }
}
