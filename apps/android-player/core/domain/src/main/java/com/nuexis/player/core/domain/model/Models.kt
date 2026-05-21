package com.nuexis.player.core.domain.model

data class Device(
    val id: String,
    val teamId: String?,
    val name: String?,
    val pairingCode: String,
    val expiresAt: String? = null,
    val status: String,
    val contentType: String?,
    val assetId: String?,
    val playlistId: String?,
    val orientation: Int?,
    val secret: String? = null
)

data class Asset(
    val id: String,
    val filePath: String,
    val mimeType: String,
    val sizeBytes: Long,
    val localFileUri: String? = null,
    val downloadStatus: DownloadStatus = DownloadStatus.PENDING
)

enum class DownloadStatus {
    PENDING, DOWNLOADING, COMPLETED, FAILED
}

data class Playlist(
    val id: String,
    val name: String?,
    val items: List<PlaylistItem> = emptyList()
)

data class PlaylistItem(
    val id: String,
    val playlistId: String?,
    val type: String,
    val assetId: String?,
    val widgetType: String?,
    val widgetConfig: String?,
    val durationSeconds: Int,
    val sortOrder: Int,
    val asset: Asset? = null
)
