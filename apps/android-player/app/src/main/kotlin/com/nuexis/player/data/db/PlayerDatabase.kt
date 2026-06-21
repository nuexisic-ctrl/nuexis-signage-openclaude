package com.nuexis.player.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [CacheEntry::class, DownloadQueueEntry::class], version = 1, exportSchema = false)
abstract class PlayerDatabase : RoomDatabase() {
    abstract fun cacheEntryDao(): CacheEntryDao
    abstract fun downloadQueueDao(): DownloadQueueDao

    companion object {
        @Volatile
        private var INSTANCE: PlayerDatabase? = null

        fun getDatabase(context: Context): PlayerDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    PlayerDatabase::class.java,
                    "player_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
