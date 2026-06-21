package com.nuexis.player.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cache_entries")
data class CacheEntry(
    @PrimaryKey val key: String,
    @ColumnInfo(name = "manifest_version") val manifestVersion: String,
    @ColumnInfo(name = "asset_id") val assetId: String,
    @ColumnInfo(name = "mime_type") val mimeType: String,
    @ColumnInfo(name = "size_bytes") val sizeBytes: Long,
    val sha256: String,
    val status: String,
    @ColumnInfo(name = "bytes_downloaded") val bytesDownloaded: Long,
    val generation: String, // "live", "staged", "archive"
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "last_used_at") val lastUsedAt: Long = System.currentTimeMillis()
)
