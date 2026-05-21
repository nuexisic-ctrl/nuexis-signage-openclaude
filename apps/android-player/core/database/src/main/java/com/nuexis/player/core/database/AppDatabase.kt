package com.nuexis.player.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.nuexis.player.core.database.dao.AssetDao
import com.nuexis.player.core.database.dao.DeviceDao
import com.nuexis.player.core.database.dao.PlaylistDao
import com.nuexis.player.core.database.entity.AssetEntity
import com.nuexis.player.core.database.entity.DeviceEntity
import com.nuexis.player.core.database.entity.PlaylistEntity
import com.nuexis.player.core.database.entity.PlaylistItemEntity
import com.nuexis.player.core.database.entity.TelemetryEntity

@Database(
    entities = [
        DeviceEntity::class,
        PlaylistEntity::class,
        PlaylistItemEntity::class,
        AssetEntity::class,
        TelemetryEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun deviceDao(): DeviceDao
    abstract fun playlistDao(): PlaylistDao
    abstract fun assetDao(): AssetDao
}
