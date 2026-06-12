package com.nuexis.player.feature.sync.repository

import com.nuexis.player.core.database.dao.AssetDao
import com.nuexis.player.core.database.dao.PlaylistDao
import com.nuexis.player.core.database.entity.AssetEntity
import com.nuexis.player.core.database.entity.PlaylistEntity
import com.nuexis.player.core.database.entity.PlaylistItemEntity
import com.nuexis.player.core.domain.model.Asset
import com.nuexis.player.core.domain.model.DownloadStatus
import com.nuexis.player.core.domain.model.Playlist
import com.nuexis.player.core.domain.model.PlaylistItem
import com.nuexis.player.core.domain.repository.PlaylistRepository
import com.nuexis.player.core.network.api.RpcPlaylistItemsRequest
import com.nuexis.player.core.network.api.SupabaseApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@OptIn(ExperimentalCoroutinesApi::class)
@Singleton
class PlaylistRepositoryImpl @Inject constructor(
    private val playlistDao: PlaylistDao,
    private val assetDao: AssetDao,
    private val supabaseApi: SupabaseApi
) : PlaylistRepository {

    override suspend fun getPlaylistItems(playlistId: String): Playlist = withContext(Dispatchers.IO) {
        val playlist = playlistDao.getPlaylist(playlistId)
            ?: throw IllegalStateException("Playlist $playlistId not found locally")
        buildPlaylist(playlist, playlistDao.getPlaylistItems(playlistId))
    }

    override fun observeLocalPlaylist(playlistId: String): Flow<Playlist?> {
        return playlistDao.observePlaylist(playlistId).flatMapLatest { playlist ->
            if (playlist == null) {
                flowOf(null)
            } else {
                playlistDao.observePlaylistItems(playlistId).flatMapLatest { items ->
                    val assetIds = items.mapNotNull { it.assetId }
                    if (assetIds.isEmpty()) {
                        flowOf(buildPlaylist(playlist, items, emptyList()))
                    } else {
                        assetDao.observeAssets(assetIds).map { assets ->
                            buildPlaylist(playlist, items, assets)
                        }
                    }
                }
            }
        }
    }

    override suspend fun syncPlaylist(playlistId: String) = withContext(Dispatchers.IO) {
        val request = RpcPlaylistItemsRequest(playlistId)
        val response = supabaseApi.getPlaylistItems(request)

        if (!response.isSuccessful) return@withContext

        val items = response.body() ?: return@withContext

        playlistDao.insertPlaylist(
            PlaylistEntity(playlistId, "Synced Playlist", System.currentTimeMillis())
        )

        val entities = items.map { item ->
            item.assets?.let { assetData ->
                if (item.asset_id != null) {
                    val existingAsset = assetDao.getAsset(item.asset_id!!)
                    if (existingAsset == null || existingAsset.filePath != assetData.file_path || existingAsset.mimeType != assetData.mime_type || existingAsset.downloadStatus == DownloadStatus.FAILED) {
                        assetDao.insertAsset(
                            AssetEntity(
                                id = item.asset_id!!,
                                filePath = assetData.file_path,
                                mimeType = assetData.mime_type,
                                sizeBytes = assetData.size_bytes ?: 0,
                                localFileUri = if (existingAsset != null && existingAsset.filePath == assetData.file_path) existingAsset.localFileUri else null,
                                downloadStatus = if (existingAsset != null && existingAsset.filePath == assetData.file_path && existingAsset.downloadStatus == DownloadStatus.COMPLETED) {
                                    DownloadStatus.COMPLETED
                                } else {
                                    DownloadStatus.PENDING
                                }
                            )
                        )
                    }
                }
            }

            PlaylistItemEntity(
                id = item.id,
                playlistId = item.playlist_id,
                type = item.type,
                assetId = item.asset_id,
                widgetType = item.widget_type,
                widgetConfig = item.widget_config?.toString(),
                durationSeconds = item.duration_seconds,
                sortOrder = item.sort_order
            )
        }

        playlistDao.replacePlaylistItems(playlistId, entities)
        assetDao.deleteUnusedAssets(entities.mapNotNull { it.assetId })
    }

    private fun buildPlaylist(
        playlist: PlaylistEntity,
        items: List<PlaylistItemEntity>,
        assets: List<AssetEntity>
    ): Playlist {
        val assetMap = assets.associateBy { it.id }
        val domainItems = items.map { item ->
            val asset = item.assetId?.let { assetMap[it]?.toDomain() }
            PlaylistItem(
                id = item.id,
                playlistId = item.playlistId,
                type = item.type,
                assetId = item.assetId,
                widgetType = item.widgetType,
                widgetConfig = item.widgetConfig,
                durationSeconds = item.durationSeconds,
                sortOrder = item.sortOrder,
                asset = asset
            )
        }
        return Playlist(id = playlist.id, name = playlist.name, items = domainItems)
    }

    private suspend fun buildPlaylist(
        playlist: PlaylistEntity,
        items: List<PlaylistItemEntity>
    ): Playlist {
        val domainItems = items.map { item ->
            val asset = item.assetId?.let { assetDao.getAsset(it)?.toDomain() }
            PlaylistItem(
                id = item.id,
                playlistId = item.playlistId,
                type = item.type,
                assetId = item.assetId,
                widgetType = item.widgetType,
                widgetConfig = item.widgetConfig,
                durationSeconds = item.durationSeconds,
                sortOrder = item.sortOrder,
                asset = asset
            )
        }
        return Playlist(id = playlist.id, name = playlist.name, items = domainItems)
    }

    private fun AssetEntity.toDomain() = Asset(
        id = id,
        filePath = filePath,
        mimeType = mimeType,
        sizeBytes = sizeBytes,
        localFileUri = localFileUri,
        downloadStatus = downloadStatus
    )
}
