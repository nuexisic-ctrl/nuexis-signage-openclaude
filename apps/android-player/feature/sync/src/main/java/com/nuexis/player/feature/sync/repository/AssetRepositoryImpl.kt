package com.nuexis.player.feature.sync.repository

import com.nuexis.player.core.database.dao.AssetDao
import com.nuexis.player.core.database.entity.AssetEntity
import com.nuexis.player.core.domain.model.Asset
import com.nuexis.player.core.domain.model.DownloadStatus
import com.nuexis.player.core.domain.repository.AssetRepository
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.network.api.RpcSignedMediaUrlRequest
import com.nuexis.player.core.network.api.SupabaseApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AssetRepositoryImpl @Inject constructor(
    private val assetDao: AssetDao,
    private val deviceRepository: DeviceRepository,
    private val supabaseApi: SupabaseApi
) : AssetRepository {

    override suspend fun getSignedMediaUrl(
        filePath: String,
        hardwareId: String,
        secret: String
    ): String = withContext(Dispatchers.IO) {
        if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
            return@withContext filePath
        }
        val request = RpcSignedMediaUrlRequest(
            pHardwareId = hardwareId,
            pSecret = secret,
            pFilePath = filePath,
            pExpiresIn = 3600
        )
        val response = supabaseApi.getPlayerSignedMediaUrl(request)
        if (!response.isSuccessful) {
            throw Exception("Signed URL failed: HTTP ${response.code()}")
        }
        val raw = response.body()?.trim()?.trim('"')
            ?: throw Exception("Signed URL response empty")
        raw
    }

    override fun observePendingDownloads(): Flow<List<Asset>> =
        assetDao.observePendingDownloads().map { entities ->
            entities.map { it.toDomain() }
        }

    override suspend fun updateAssetStatus(
        assetId: String,
        status: DownloadStatus,
        localUri: String?
    ) {
        assetDao.updateAssetStatus(assetId, status.name, localUri)
    }

    override suspend fun cleanupUnusedAssets(activeAssetIds: List<String>) {
        assetDao.deleteUnusedAssets(activeAssetIds)
    }

    override suspend fun resetFailedDownloads() {
        assetDao.resetFailedDownloads()
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
