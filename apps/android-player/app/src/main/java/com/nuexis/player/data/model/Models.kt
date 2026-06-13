package com.nuexis.player.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DeviceState(
    val id: String,
    @SerialName("team_id") val teamId: String? = null,
    val name: String? = null,
    @SerialName("pairing_code") val pairingCode: String? = null,
    @SerialName("expires_at") val expiresAt: String? = null,
    val status: String,
    @SerialName("content_type") val contentType: String? = null,
    @SerialName("asset_id") val assetId: String? = null,
    @SerialName("playlist_id") val playlistId: String? = null,
    val orientation: Int? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_seen_at") val lastSeenAt: String? = null
)

@Serializable
data class ManifestResponse(
    @SerialName("manifest_version") val manifestVersion: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("content_type") val contentType: String? = null,
    val orientation: Int = 0,
    @SerialName("loop_enabled") val loopEnabled: Boolean = true,
    @SerialName("transition_ms") val transitionMs: Int = 350,
    val playlist: List<PlaylistItem> = emptyList()
)

@Serializable
data class PlaylistItem(
    val id: String,
    val type: String, // "image", "video", "widget"
    @SerialName("asset_id") val assetId: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Int = 15,
    @SerialName("sort_order") val sortOrder: Int = 0,
    val asset: AssetDetails? = null,
    @SerialName("widget_type") val widgetType: String? = null,
    @SerialName("widget_config") val widgetConfig: String? = null
)

@Serializable
data class AssetDetails(
    val id: String,
    @SerialName("file_name") val fileName: String,
    @SerialName("file_path") val filePath: String,
    @SerialName("mime_type") val mimeType: String,
    @SerialName("size_bytes") val sizeBytes: Long? = null
)

@Serializable
data class RegistrationResult(
    val id: String,
    @SerialName("expires_at") val expiresAt: String? = null,
    val secret: String,
    @SerialName("team_id") val teamId: String? = null,
    val status: String? = null
)

@Serializable
data class ExchangeSessionResult(
    @SerialName("device_id") val deviceId: String,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("session_token") val sessionToken: String,
    @SerialName("expires_at") val expiresAt: String,
    val manifest: ManifestResponse
)
