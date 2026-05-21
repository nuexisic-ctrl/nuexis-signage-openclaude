package com.nuexis.player.feature.sync.di

import com.nuexis.player.core.domain.realtime.RealtimeSyncTrigger
import com.nuexis.player.core.domain.repository.AssetRepository
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.domain.repository.PlaylistRepository
import com.nuexis.player.core.domain.repository.SyncRepository
import com.nuexis.player.core.domain.sync.SyncWorkScheduler
import com.nuexis.player.feature.sync.realtime.RealtimeSyncTriggerImpl
import com.nuexis.player.feature.sync.repository.AssetRepositoryImpl
import com.nuexis.player.feature.sync.repository.DeviceRepositoryImpl
import com.nuexis.player.feature.sync.repository.PlaylistRepositoryImpl
import com.nuexis.player.feature.sync.repository.SyncRepositoryImpl
import com.nuexis.player.feature.sync.work.SyncWorkSchedulerImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class SyncModule {

    @Binds
    abstract fun bindSyncRepository(
        syncRepositoryImpl: SyncRepositoryImpl
    ): SyncRepository

    @Binds
    abstract fun bindDeviceRepository(
        deviceRepositoryImpl: DeviceRepositoryImpl
    ): DeviceRepository

    @Binds
    abstract fun bindPlaylistRepository(
        playlistRepositoryImpl: PlaylistRepositoryImpl
    ): PlaylistRepository

    @Binds
    abstract fun bindAssetRepository(
        assetRepositoryImpl: AssetRepositoryImpl
    ): AssetRepository

    @Binds
    abstract fun bindRealtimeSyncTrigger(
        impl: RealtimeSyncTriggerImpl
    ): RealtimeSyncTrigger

    @Binds
    abstract fun bindSyncWorkScheduler(
        impl: SyncWorkSchedulerImpl
    ): SyncWorkScheduler
}
