package com.nuexis.player.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.nuexis.player.core.domain.model.DownloadStatus

@Entity(tableName = "devices")
data class DeviceEntity(
    @PrimaryKey val id: String,
    val teamId: String?,
    val name: String?,
    val pairingCode: String,
    val expiresAt: String,
    val status: String,
    val contentType: String?,
    val assetId: String?,
    val playlistId: String?,
    val orientation: Int?,
    val createdAt: String,
    val lastSeenAt: String?
)

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String?,
    val lastUpdated: Long
)

@Entity(tableName = "playlist_items")
data class PlaylistItemEntity(
    @PrimaryKey val id: String,
    val playlistId: String?,
    val type: String,
    val assetId: String?,
    val widgetType: String?,
    val widgetConfig: String?,
    val durationSeconds: Int,
    val sortOrder: Int
)

@Entity(tableName = "assets")
data class AssetEntity(
    @PrimaryKey val id: String,
    val filePath: String,
    val mimeType: String,
    val sizeBytes: Long,
    val localFileUri: String?,
    val downloadStatus: DownloadStatus
)

@Entity(tableName = "telemetry")
data class TelemetryEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val deviceId: String,
    val playtimeSeconds: Long,
    val timestamp: Long,
    val isSynced: Boolean = false
)
