package com.nuexis.player.core.domain.realtime

/**
 * Callback from [com.nuexis.player.core.network.realtime.PlayerRealtimeManager]
 * into the sync layer (implemented in :feature:sync).
 */
interface RealtimeSyncTrigger {
    suspend fun onSyncRequested(reason: String = "realtime")
    suspend fun onDeviceUnpaired()
}

data class PlayerRealtimeSession(
    val deviceId: String,
    val teamId: String,
    val playlistId: String?
)
