package com.nuexis.player.core.network.realtime

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DevicePresencePayload(
    @SerialName("device_id") val deviceId: String,
    @SerialName("online_at") val onlineAt: String
)

@Serializable
data class PlaylistRefreshBroadcast(
    val timestamp: Long = 0L
)

@Serializable
data class DeviceRealtimeRow(
    val id: String? = null,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("content_type") val contentType: String? = null,
    @SerialName("playlist_id") val playlistId: String? = null,
    @SerialName("asset_id") val assetId: String? = null,
    val orientation: Int? = null
)
