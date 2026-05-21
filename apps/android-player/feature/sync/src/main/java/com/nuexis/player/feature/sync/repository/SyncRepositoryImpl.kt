package com.nuexis.player.feature.sync.repository

import com.nuexis.player.core.database.dao.DeviceDao
import com.nuexis.player.core.database.entity.DeviceEntity
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.domain.repository.PlaylistRepository
import com.nuexis.player.core.domain.repository.SyncRepository
import com.nuexis.player.core.domain.sync.SyncWorkScheduler
import com.nuexis.player.core.network.api.RpcDeviceStateRequest
import com.nuexis.player.core.network.api.SupabaseApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncRepositoryImpl @Inject constructor(
    private val supabaseApi: SupabaseApi,
    private val deviceDao: DeviceDao,
    private val deviceRepository: DeviceRepository,
    private val playlistRepository: PlaylistRepository,
    private val syncWorkScheduler: SyncWorkScheduler
) : SyncRepository {

    override suspend fun syncDeviceState() = withContext(Dispatchers.IO) {
        val hardwareId = deviceRepository.getHardwareId()
        val secret = deviceRepository.getSecret() ?: return@withContext

        val request = RpcDeviceStateRequest(
            pHardwareId = hardwareId,
            pSecret = secret
        )
        val response = supabaseApi.getDeviceState(request)

        if (response.isSuccessful) {
            val state = response.body() ?: return@withContext
            val updatedDevice = DeviceEntity(
                id = state.id,
                teamId = state.team_id,
                name = state.name,
                pairingCode = state.pairing_code,
                expiresAt = state.expires_at,
                status = state.status,
                contentType = state.content_type,
                assetId = state.asset_id,
                playlistId = state.playlist_id,
                orientation = state.orientation,
                createdAt = state.created_at,
                lastSeenAt = state.last_seen_at
            )
            deviceDao.insertOrUpdateDevice(updatedDevice)

            if (state.content_type == "Playlist" && state.playlist_id != null) {
                playlistRepository.syncPlaylist(state.playlist_id!!)
                syncWorkScheduler.enqueueDownload()
            }
        }
    }
}
