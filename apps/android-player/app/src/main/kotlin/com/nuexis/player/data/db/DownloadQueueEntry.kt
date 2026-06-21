package com.nuexis.player.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "download_queue")
data class DownloadQueueEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "asset_id") val assetId: String,
    @ColumnInfo(name = "file_path") val filePath: String,
    @ColumnInfo(name = "expected_size") val expectedSize: Long,
    @ColumnInfo(name = "expected_sha256") val expectedSha256: String,
    val priority: Int = 0,
    val status: String, // PENDING, DOWNLOADING, VALIDATING, READY, FAILED, RETRYING
    @ColumnInfo(name = "attempt_count") val attemptCount: Int = 0,
    @ColumnInfo(name = "bytes_downloaded") val bytesDownloaded: Long = 0L,
    @ColumnInfo(name = "error_message") val errorMessage: String? = null,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at") val updatedAt: Long = System.currentTimeMillis()
)
