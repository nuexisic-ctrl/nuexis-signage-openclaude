package com.nuexis.player.feature.sync.repository

import android.content.Context
import android.provider.Settings
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.nuexis.player.core.database.dao.DeviceDao
import com.nuexis.player.core.database.entity.DeviceEntity
import com.nuexis.player.core.domain.model.Device
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.network.api.RpcDeviceStateRequest
import com.nuexis.player.core.network.api.RpcIncrementPlaytimeRequest
import com.nuexis.player.core.network.api.RpcRefreshDeviceRequest
import com.nuexis.player.core.network.api.RpcRegisterDeviceRequest
import com.nuexis.player.core.network.api.RpcRegisterDeviceResponse
import com.nuexis.player.core.network.api.SupabaseApi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val deviceDao: DeviceDao,
    private val supabaseApi: SupabaseApi
) : DeviceRepository {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPrefs = EncryptedSharedPreferences.create(
        context,
        "secret_shared_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    override suspend fun getHardwareId(): String = withContext(Dispatchers.IO) {
        var hwId = sharedPrefs.getString("hardware_id", null)
        if (hwId == null) {
            hwId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                ?: UUID.randomUUID().toString()
            sharedPrefs.edit().putString("hardware_id", hwId).apply()
        }
        hwId
    }

    override suspend fun getSecret(): String? = withContext(Dispatchers.IO) {
        sharedPrefs.getString("device_secret", null)
    }

    override suspend fun saveSecret(secret: String) = withContext(Dispatchers.IO) {
        sharedPrefs.edit().putString("device_secret", secret).apply()
    }

    override suspend fun registerDevice(
        hardwareId: String,
        pairingCode: String,
        expiresAtMs: Long
    ): Device = withContext(Dispatchers.IO) {
        val request = RpcRegisterDeviceRequest(
            pHardwareId = hardwareId,
            pPairingCode = pairingCode,
            pExpiresAt = expiresAtIso(expiresAtMs)
        )
        val response = supabaseApi.registerDevice(request)
        val body = response.body()
        if (!response.isSuccessful || body == null) {
            throw apiException("register device", response.code(), response.errorBody()?.string())
        }
        persistRegistration(body, pairingCode)
    }

    override suspend fun refreshPairingCode(
        deviceId: String,
        hardwareId: String,
        secret: String,
        pairingCode: String,
        expiresAtMs: Long
    ): Device = withContext(Dispatchers.IO) {
        val request = RpcRefreshDeviceRequest(
            pDeviceId = deviceId,
            pHardwareId = hardwareId,
            pSecret = secret,
            pPairingCode = pairingCode,
            pExpiresAt = expiresAtIso(expiresAtMs)
        )
        val response = supabaseApi.refreshDeviceCode(request)
        val body = response.body()
        if (!response.isSuccessful || body == null) {
            throw apiException("refresh pairing code", response.code(), response.errorBody()?.string())
        }
        val device = Device(
            id = body.id,
            teamId = null,
            name = null,
            pairingCode = pairingCode,
            expiresAt = body.expires_at,
            status = "pairing",
            contentType = null,
            assetId = null,
            playlistId = null,
            orientation = 0,
            secret = secret
        )
        deviceDao.insertOrUpdateDevice(device.toEntity(expiresAt = body.expires_at))
        device
    }

    override suspend fun getDeviceState(hardwareId: String, secret: String?): Device? =
        withContext(Dispatchers.IO) {
            val request = RpcDeviceStateRequest(
                pHardwareId = hardwareId,
                pSecret = secret
            )
            val response = supabaseApi.getDeviceState(request)
            if (!response.isSuccessful) {
                return@withContext deviceDao.getDevice()?.toDomain()
            }
            val state = response.body() ?: return@withContext null
            val device = state.toDomain(secret ?: getSecret())
            deviceDao.insertOrUpdateDevice(device.toEntity(expiresAt = state.expires_at))
            device
        }

    override fun observeLocalDeviceState(): Flow<Device?> {
        return deviceDao.observeDevice().map { it?.toDomain() }
    }

    override suspend fun updateLocalDeviceState(device: Device) {
        deviceDao.insertOrUpdateDevice(device.toEntity())
    }

    override suspend fun incrementPlaytime(
        deviceId: String,
        hardwareId: String,
        secret: String,
        seconds: Long
    ) {
        withContext(Dispatchers.IO) {
            val req = RpcIncrementPlaytimeRequest(deviceId, hardwareId, secret, seconds)
            supabaseApi.incrementPlaytime(req)
        }
    }

    private suspend fun persistRegistration(
        body: RpcRegisterDeviceResponse,
        pairingCode: String
    ): Device {
        saveSecret(body.secret)
        val device = Device(
            id = body.id,
            teamId = null,
            name = null,
            pairingCode = pairingCode,
            expiresAt = body.expires_at,
            status = "pairing",
            contentType = null,
            assetId = null,
            playlistId = null,
            orientation = 0,
            secret = body.secret
        )
        deviceDao.insertOrUpdateDevice(device.toEntity(expiresAt = body.expires_at))
        return device
    }

    private fun expiresAtIso(expiresAtMs: Long): String =
        Instant.ofEpochMilli(expiresAtMs).toString()

    private fun apiException(action: String, code: Int, body: String?): Exception {
        val detail = body?.take(200)?.ifBlank { null }
        return Exception(
            if (detail != null) "Failed to $action (HTTP $code): $detail"
            else "Failed to $action (HTTP $code)"
        )
    }

    private fun com.nuexis.player.core.network.api.RpcDeviceStateResponse.toDomain(
        secret: String?
    ) = Device(
        id = id,
        teamId = team_id,
        name = name,
        pairingCode = pairing_code,
        expiresAt = expires_at,
        status = status,
        contentType = content_type,
        assetId = asset_id,
        playlistId = playlist_id,
        orientation = orientation,
        secret = secret
    )

    private fun Device.toEntity(expiresAt: String = "") = DeviceEntity(
        id = id,
        teamId = teamId,
        name = name,
        pairingCode = pairingCode,
        expiresAt = expiresAt,
        status = status,
        contentType = contentType,
        assetId = assetId,
        playlistId = playlistId,
        orientation = orientation,
        createdAt = "",
        lastSeenAt = ""
    )

    private fun DeviceEntity.toDomain() = Device(
        id = id,
        teamId = teamId,
        name = name,
        pairingCode = pairingCode,
        expiresAt = expiresAt,
        status = status,
        contentType = contentType,
        assetId = assetId,
        playlistId = playlistId,
        orientation = orientation,
        secret = sharedPrefs.getString("device_secret", null)
    )
}
