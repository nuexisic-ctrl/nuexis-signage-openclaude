package com.nuexis.player.data.db

import androidx.room.*

@Dao
interface DownloadQueueDao {
    @Query("SELECT * FROM download_queue WHERE status = 'PENDING' OR status = 'RETRYING' ORDER BY priority DESC, created_at ASC LIMIT 1")
    suspend fun getNextPending(): DownloadQueueEntry?

    @Query("SELECT * FROM download_queue WHERE status = :status")
    suspend fun getAllByStatus(status: String): List<DownloadQueueEntry>

    @Query("SELECT * FROM download_queue WHERE asset_id = :assetId LIMIT 1")
    suspend fun getByAssetId(assetId: String): DownloadQueueEntry?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: DownloadQueueEntry): Long

    @Update
    suspend fun update(entry: DownloadQueueEntry)

    @Delete
    suspend fun delete(entry: DownloadQueueEntry)

    @Query("DELETE FROM download_queue WHERE status = 'READY'")
    suspend fun deleteCompleted()

    @Query("DELETE FROM download_queue")
    suspend fun clearQueue()

    @Query("SELECT SUM(bytes_downloaded) FROM download_queue")
    suspend fun getTotalBytesDownloaded(): Long?

    @Query("SELECT SUM(expected_size) FROM download_queue")
    suspend fun getTotalExpectedBytes(): Long?
}
