package com.nuexis.player.core.database.di

import android.content.Context
import androidx.room.Room
import com.nuexis.player.core.database.AppDatabase
import com.nuexis.player.core.database.dao.AssetDao
import com.nuexis.player.core.database.dao.DeviceDao
import com.nuexis.player.core.database.dao.PlaylistDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "nuexis_player_db"
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    fun provideDeviceDao(db: AppDatabase): DeviceDao = db.deviceDao()

    @Provides
    fun providePlaylistDao(db: AppDatabase): PlaylistDao = db.playlistDao()

    @Provides
    fun provideAssetDao(db: AppDatabase): AssetDao = db.assetDao()
}
