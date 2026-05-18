package com.nuexis.player.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class PlayerState {
    BOOTING,
    PAIRING,
    PAIRED,
    OFFLINE,
    ERROR
}

enum class PlaybackEventType {
    START,
    READY,
    PROGRESS,
    COMPLETE,
    ERROR,
    SKIPPED
}

@Serializable
data class RegisterDeviceResponse(
    val id: String,
    @SerialName("expires_at") val expiresAt: String,
    val secret: String
)

@Serializable
data class DeviceStateResponse(
    val id: String,
    @SerialName("team_id") val teamId: String? = null,
    val name: String? = null,
    @SerialName("pairing_code") val pairingCode: String? = null,
    @SerialName("expires_at") val expiresAt: String? = null,
    val status: String? = null,
    @SerialName("content_type") val contentType: String? = null,
    @SerialName("asset_id") val assetId: String? = null,
    @SerialName("playlist_id") val playlistId: String? = null,
    val orientation: Int? = null,
    @SerialName("last_seen_at") val lastSeenAt: String? = null
)

@Serializable
data class DeviceSessionResponse(
    @SerialName("device_id") val deviceId: String,
    @SerialName("team_id") val teamId: String,
    @SerialName("session_token") val sessionToken: String,
    @SerialName("expires_at") val expiresAt: String,
    val manifest: PlayerManifest? = null
)

@Serializable
data class PlayerManifest(
    @SerialName("manifest_version") val manifestVersion: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("team_id") val teamId: String,
    @SerialName("content_type") val contentType: String? = null,
    val orientation: Int = 0,
    @SerialName("loop_enabled") val loopEnabled: Boolean = true,
    @SerialName("transition_ms") val transitionMs: Long = 350,
    val assignment: ManifestAssignment? = null,
    val playlist: List<ManifestItem> = emptyList()
)

@Serializable
data class ManifestAssignment(
    @SerialName("asset_id") val assetId: String? = null,
    @SerialName("playlist_id") val playlistId: String? = null
)

@Serializable
data class ManifestItem(
    val id: String,
    val type: String,
    @SerialName("asset_id") val assetId: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Int = 10,
    @SerialName("sort_order") val sortOrder: Int = 0,
    val asset: ManifestAsset? = null
)

@Serializable
data class ManifestAsset(
    val id: String,
    @SerialName("file_name") val fileName: String? = null,
    @SerialName("file_path") val filePath: String,
    @SerialName("mime_type") val mimeType: String,
    @SerialName("size_bytes") val sizeBytes: Long = 0,
    @SerialName("signed_url") val signedUrl: String? = null
)

@Serializable
data class PlaybackEventRequest(
    @SerialName("p_device_id") val deviceId: String,
    @SerialName("p_session_token") val sessionToken: String,
    @SerialName("p_event_type") val eventType: String,
    @SerialName("p_item_id") val itemId: String? = null,
    @SerialName("p_asset_id") val assetId: String? = null,
    @SerialName("p_position_ms") val positionMs: Long = 0,
    @SerialName("p_duration_ms") val durationMs: Long = 0,
    @SerialName("p_cache_status") val cacheStatus: String? = null,
    @SerialName("p_error_message") val errorMessage: String? = null
)

@Serializable
data class HealthEventRequest(
    @SerialName("p_device_id") val deviceId: String,
    @SerialName("p_session_token") val sessionToken: String,
    @SerialName("p_app_version") val appVersion: String,
    @SerialName("p_os_version") val osVersion: String,
    @SerialName("p_free_disk_bytes") val freeDiskBytes: Long,
    @SerialName("p_memory_class_mb") val memoryClassMb: Int,
    @SerialName("p_network_type") val networkType: String,
    @SerialName("p_manifest_version") val manifestVersion: String? = null,
    @SerialName("p_current_item_id") val currentItemId: String? = null,
    @SerialName("p_last_error") val lastError: String? = null
)

@Serializable
data class MediaUrlRequest(
    @SerialName("deviceId") val deviceId: String,
    @SerialName("sessionToken") val sessionToken: String,
    @SerialName("filePath") val filePath: String
)

@Serializable
data class MediaUrlResponse(
    @SerialName("signedUrl") val signedUrl: String
)
