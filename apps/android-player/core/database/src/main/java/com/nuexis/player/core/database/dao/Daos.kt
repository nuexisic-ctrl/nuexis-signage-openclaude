package com.nuexis.player.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.nuexis.player.core.database.entity.AssetEntity
import com.nuexis.player.core.database.entity.DeviceEntity
import com.nuexis.player.core.database.entity.PlaylistEntity
import com.nuexis.player.core.database.entity.PlaylistItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DeviceDao {
    @Query("SELECT * FROM devices LIMIT 1")
    fun observeDevice(): Flow<DeviceEntity?>

    @Query("SELECT * FROM devices LIMIT 1")
    suspend fun getDevice(): DeviceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateDevice(device: DeviceEntity)

    @Query("DELETE FROM devices")
    suspend fun deleteAllDevices()
}

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists WHERE id = :playlistId")
    fun observePlaylist(playlistId: String): Flow<PlaylistEntity?>

    @Query("SELECT * FROM playlists WHERE id = :playlistId")
    suspend fun getPlaylist(playlistId: String): PlaylistEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylistItems(items: List<PlaylistItemEntity>)

    @Query("SELECT * FROM playlist_items WHERE playlistId = :playlistId ORDER BY sortOrder ASC")
    fun observePlaylistItems(playlistId: String): Flow<List<PlaylistItemEntity>>

    @Query("SELECT * FROM playlist_items WHERE playlistId = :playlistId ORDER BY sortOrder ASC")
    suspend fun getPlaylistItems(playlistId: String): List<PlaylistItemEntity>

    @Query("DELETE FROM playlist_items WHERE playlistId = :playlistId")
    suspend fun deleteItemsForPlaylist(playlistId: String)

    @Transaction
    suspend fun replacePlaylistItems(playlistId: String, items: List<PlaylistItemEntity>) {
        deleteItemsForPlaylist(playlistId)
        insertPlaylistItems(items)
    }
}

@Dao
interface AssetDao {
    @Query("SELECT * FROM assets WHERE id = :assetId")
    suspend fun getAsset(assetId: String): AssetEntity?

    @Query("SELECT * FROM assets WHERE id = :assetId")
    fun observeAsset(assetId: String): Flow<AssetEntity?>

    @Query("SELECT * FROM assets WHERE id IN (:assetIds)")
    fun observeAssets(assetIds: List<String>): Flow<List<AssetEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAsset(asset: AssetEntity)

    @Query("UPDATE assets SET downloadStatus = :status, localFileUri = :localUri WHERE id = :assetId")
    suspend fun updateAssetStatus(assetId: String, status: String, localUri: String?)

    @Query("SELECT * FROM assets WHERE downloadStatus = 'PENDING'")
    fun observePendingDownloads(): Flow<List<AssetEntity>>

    @Query("UPDATE assets SET downloadStatus = 'PENDING' WHERE downloadStatus = 'FAILED'")
    suspend fun resetFailedDownloads()

    @Query("DELETE FROM assets WHERE id NOT IN (:activeAssetIds)")
    suspend fun deleteUnusedAssets(activeAssetIds: List<String>)
}
