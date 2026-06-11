package com.nuexis.player.core.network.api

import com.google.gson.annotations.SerializedName

data class RpcRegisterDeviceRequest(
    @SerializedName("p_hardware_id") val pHardwareId: String,
    @SerializedName("p_pairing_code") val pPairingCode: String,
    @SerializedName("p_expires_at") val pExpiresAt: String
)

data class RpcRegisterDeviceResponse(
    val id: String,
    val expires_at: String,
    val secret: String
)

data class RpcRefreshDeviceRequest(
    @SerializedName("p_device_id") val pDeviceId: String,
    @SerializedName("p_hardware_id") val pHardwareId: String,
    @SerializedName("p_secret") val pSecret: String,
    @SerializedName("p_pairing_code") val pPairingCode: String,
    @SerializedName("p_expires_at") val pExpiresAt: String
)

data class RpcRefreshDeviceResponse(
    val id: String,
    val expires_at: String
)

data class RpcDeviceStateRequest(
    @SerializedName("p_hardware_id") val pHardwareId: String,
    @SerializedName("p_secret") val pSecret: String?
)

data class RpcDeviceStateResponse(
    val id: String,
    val team_id: String?,
    val name: String?,
    val pairing_code: String,
    val expires_at: String,
    val status: String,
    val content_type: String?,
    val asset_id: String?,
    val playlist_id: String?,
    val orientation: Int?,
    val created_at: String,
    val last_seen_at: String?
)

data class RpcPlaylistItemsRequest(
    @SerializedName("p_playlist_id") val pPlaylistId: String
)

data class RpcPlaylistItemResponse(
    val id: String,
    val playlist_id: String?,
    val type: String,
    val asset_id: String?,
    val widget_type: String?,
    val widget_config: Any?,
    val duration_seconds: Int,
    val sort_order: Int,
    val assets: RpcAssetData?
)

data class RpcAssetData(
    val file_path: String,
    val mime_type: String,
    val size_bytes: Long?
)

data class RpcIncrementPlaytimeRequest(
    @SerializedName("p_device_id") val pDeviceId: String,
    @SerializedName("p_hardware_id") val pHardwareId: String,
    @SerializedName("p_secret") val pSecret: String,
    @SerializedName("p_seconds") val pSeconds: Long
)

data class RpcSignedMediaUrlRequest(
    @SerializedName("p_hardware_id") val pHardwareId: String,
    @SerializedName("p_secret") val pSecret: String,
    @SerializedName("p_file_path") val pFilePath: String,
    @SerializedName("p_expires_in") val pExpiresIn: Int = 3600
)

data class RpcGetAssetRequest(
    @SerializedName("p_hardware_id") val pHardwareId: String,
    @SerializedName("p_secret") val pSecret: String,
    @SerializedName("p_asset_id") val pAssetId: String
)

data class RpcGetAssetResponse(
    @SerializedName("file_path") val filePath: String,
    @SerializedName("mime_type") val mimeType: String,
    @SerializedName("size_bytes") val sizeBytes: Long? = null
)
