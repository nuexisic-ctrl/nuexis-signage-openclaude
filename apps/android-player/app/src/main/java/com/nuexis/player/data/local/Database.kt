package com.nuexis.player.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "device_config")
data class DeviceConfig(
    @PrimaryKey val id: String = "primary_device",
    val deviceId: String? = null,
    val hardwareId: String = "",
    val secret: String? = null,
    val sessionToken: String? = null,
    val teamId: String? = null,
    val status: String = "pairing",
    val currentManifestVersion: String? = null,
    val orientation: Int = 0,
    val isMuted: Boolean = true,
    val scaleMode: String = "Fit",
    val pairingCode: String = "",
    val expiresAt: String = "",
    val contentType: String? = null,
    val assetId: String? = null,
    val playlistId: String? = null,
    val loopEnabled: Boolean = true,
    val shuffleEnabled: Boolean = false
)

@Entity(tableName = "cached_playlist_items")
data class CachedPlaylistItem(
    @PrimaryKey val id: String,
    val type: String, // image, video, widget
    val assetId: String?,
    val durationSeconds: Int,
    val sortOrder: Int,
    val fileName: String?,
    val filePath: String?, // Remote path
    val localUri: String?, // Local file URI
    val mimeType: String?,
    val widgetType: String?,
    val widgetConfig: String?
)

@Dao
interface DeviceConfigDao {
    @Query("SELECT * FROM device_config WHERE id = 'primary_device' LIMIT 1")
    suspend fun getConfig(): DeviceConfig?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfig(config: DeviceConfig)

    @Query("UPDATE device_config SET sessionToken = :token, teamId = :teamId, status = :status WHERE id = 'primary_device'")
    suspend fun updateSession(token: String?, teamId: String?, status: String)

    @Query("UPDATE device_config SET orientation = :orientation WHERE id = 'primary_device'")
    suspend fun updateOrientation(orientation: Int)

    @Query("UPDATE device_config SET isMuted = :isMuted WHERE id = 'primary_device'")
    suspend fun updateMute(isMuted: Boolean)

    @Query("UPDATE device_config SET scaleMode = :scaleMode WHERE id = 'primary_device'")
    suspend fun updateScaleMode(scaleMode: String)
    
    @Query("UPDATE device_config SET currentManifestVersion = :version WHERE id = 'primary_device'")
    suspend fun updateManifestVersion(version: String?)

    @Query("UPDATE device_config SET loopEnabled = :loopEnabled WHERE id = 'primary_device'")
    suspend fun updateLoop(loopEnabled: Boolean)

    @Query("UPDATE device_config SET shuffleEnabled = :shuffleEnabled WHERE id = 'primary_device'")
    suspend fun updateShuffle(shuffleEnabled: Boolean)
}

@Dao
interface PlaylistItemDao {
    @Query("SELECT * FROM cached_playlist_items ORDER BY sortOrder ASC")
    suspend fun getPlaylist(): List<CachedPlaylistItem>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<CachedPlaylistItem>)

    @Query("DELETE FROM cached_playlist_items")
    suspend fun clearPlaylist()
}

@Database(entities = [DeviceConfig::class, CachedPlaylistItem::class], version = 2, exportSchema = false)
abstract class PlayerDatabase : RoomDatabase() {
    abstract fun deviceConfigDao(): DeviceConfigDao
    abstract fun playlistItemDao(): PlaylistItemDao
}
