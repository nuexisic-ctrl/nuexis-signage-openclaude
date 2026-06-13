package com.nuexis.player.data.remote

import android.content.Context
import android.util.Log
import com.nuexis.player.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit

class SupabaseApi {

    companion object {
        private const val TAG = "SupabaseApi"
        const val SUPABASE_URL = "https://dpdabdbqhjkmxvwnukev.supabase.co"
        const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZGFiZGJxaGprbXh2d251a2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzMxMTIsImV4cCI6MjA5MzkwOTExMn0.VR0ZMijdHRokIFiXiIZ6rQsKoGtokp8GZh5C-vSvcpI"
        
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        })
        .build()

    private suspend inline fun <reified T, reified R> callRpc(
        rpcName: String,
        payload: T
    ): R? = withContext(Dispatchers.IO) {
        try {
            val bodyString = json.encodeToString(payload)
            Log.d(TAG, "Calling RPC: $rpcName with payload: $bodyString")
            val requestBody = bodyString.toRequestBody(JSON_MEDIA_TYPE)

            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/rpc/$rpcName")
                .post(requestBody)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseBody = response.body?.string()
                if (!response.isSuccessful) {
                    Log.e(TAG, "RPC $rpcName failed with status: ${response.code}, body: $responseBody")
                    return@withContext null
                }

                if (responseBody == null) {
                    return@withContext null
                }

                // If return type is String (like signed url) or Void, handle separately
                if (R::class == String::class) {
                    try {
                        val element = json.parseToJsonElement(responseBody)
                        if (element is JsonPrimitive) {
                            return@withContext element.content as R
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse String response as JSON element", e)
                    }
                    
                    val cleaned = if (responseBody.startsWith("\"") && responseBody.endsWith("\"")) {
                        responseBody.substring(1, responseBody.length - 1)
                    } else {
                        responseBody
                    }
                    return@withContext cleaned as R
                }

                if (R::class == Unit::class) {
                    return@withContext Unit as R
                }

                return@withContext json.decodeFromString<R>(responseBody)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception calling RPC $rpcName", e)
            null
        }
    }

    // ── RPC: register_player_device ──
    @Serializable
    private data class RegisterPayload(
        @SerialName("p_hardware_id") val hardwareId: String,
        @SerialName("p_pairing_code") val pairingCode: String,
        @SerialName("p_expires_at") val expiresAt: String
    )

    suspend fun registerPlayerDevice(
        hardwareId: String,
        pairingCode: String,
        expiresAtIso: String
    ): RegistrationResult? {
        val payload = RegisterPayload(hardwareId, pairingCode, expiresAtIso)
        return callRpc("register_player_device", payload)
    }

    // ── RPC: get_player_device_state ──
    @Serializable
    private data class DeviceStatePayload(
        @SerialName("p_hardware_id") val hardwareId: String,
        @SerialName("p_secret") val secret: String?
    )

    suspend fun getDeviceState(hardwareId: String, secret: String?): DeviceState? {
        val payload = DeviceStatePayload(hardwareId, secret)
        return callRpc("get_player_device_state", payload)
    }

    // ── RPC: exchange_device_secret_for_session ──
    @Serializable
    private data class ExchangePayload(
        @SerialName("p_device_id") val deviceId: String,
        @SerialName("p_hardware_id") val hardwareId: String,
        @SerialName("p_secret") val secret: String
    )

    suspend fun exchangeDeviceSecretForSession(
        deviceId: String,
        hardwareId: String,
        secret: String
    ): ExchangeSessionResult? {
        val payload = ExchangePayload(deviceId, hardwareId, secret)
        return callRpc("exchange_device_secret_for_session", payload)
    }

    // ── RPC: get_player_manifest ──
    @Serializable
    private data class ManifestPayload(
        @SerialName("p_device_id") val deviceId: String,
        @SerialName("p_session_token") val sessionToken: String
    )

    suspend fun getPlayerManifest(deviceId: String, sessionToken: String): ManifestResponse? {
        val payload = ManifestPayload(deviceId, sessionToken)
        return callRpc("get_player_manifest", payload)
    }

    // ── CMS Endpoint: media-url ──
    @Serializable
    private data class MediaUrlRequest(
        val deviceId: String,
        val sessionToken: String,
        val filePath: String
    )

    @Serializable
    private data class MediaUrlResponse(
        val signedUrl: String? = null,
        val error: String? = null
    )

    private fun getCmsUrl(): String {
        return if (SUPABASE_URL.contains("localhost") || SUPABASE_URL.contains("127.0.0.1") || SUPABASE_URL.contains("10.0.2.2")) {
            "http://10.0.2.2:3000"
        } else {
            "https://app.nuexis.com"
        }
    }

    suspend fun getSignedMediaUrl(
        deviceId: String,
        sessionToken: String,
        filePath: String
    ): String? = withContext(Dispatchers.IO) {
        try {
            val cmsUrl = getCmsUrl()
            val requestBody = json.encodeToString(MediaUrlRequest(deviceId, sessionToken, filePath))
            Log.d(TAG, "Requesting signed media URL from CMS: $cmsUrl/api/player/media-url for path: $filePath")
            
            val request = Request.Builder()
                .url("$cmsUrl/api/player/media-url")
                .post(requestBody.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            client.newCall(request).execute().use { response ->
                val responseBody = response.body?.string()
                if (!response.isSuccessful || responseBody == null) {
                    Log.e(TAG, "CMS media-url signing failed with status: ${response.code}, body: $responseBody")
                    return@withContext null
                }
                val result = json.decodeFromString<MediaUrlResponse>(responseBody)
                return@withContext result.signedUrl
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception requesting signed media URL", e)
            null
        }
    }

    // ── RPC: get_player_asset ──
    @Serializable
    private data class PlayerAssetPayload(
        @SerialName("p_hardware_id") val hardwareId: String,
        @SerialName("p_secret") val secret: String,
        @SerialName("p_asset_id") val assetId: String
    )

    @Serializable
    data class PlayerAssetResult(
        @SerialName("file_path") val filePath: String,
        @SerialName("mime_type") val mimeType: String
    )

    suspend fun getPlayerAsset(
        hardwareId: String,
        secret: String,
        assetId: String
    ): PlayerAssetResult? {
        val payload = PlayerAssetPayload(hardwareId, secret, assetId)
        return callRpc("get_player_asset", payload)
    }

    // ── RPC: report_device_health ──
    @Serializable
    private data class HealthPayload(
        @SerialName("p_device_id") val deviceId: String,
        @SerialName("p_session_token") val sessionToken: String,
        @SerialName("p_app_version") val appVersion: String?,
        @SerialName("p_os_version") val osVersion: String?,
        @SerialName("p_free_disk_bytes") val freeDiskBytes: Long?,
        @SerialName("p_memory_class_mb") val memoryClassMb: Int?,
        @SerialName("p_network_type") val networkType: String?,
        @SerialName("p_manifest_version") val manifestVersion: String?,
        @SerialName("p_current_item_id") val currentItemId: String?,
        @SerialName("p_last_error") val lastError: String?
    )

    @Serializable
    private data class HealthResult(val ok: Boolean)

    suspend fun reportDeviceHealth(
        deviceId: String,
        sessionToken: String,
        appVersion: String?,
        osVersion: String?,
        freeDiskBytes: Long?,
        memoryClassMb: Int?,
        networkType: String?,
        manifestVersion: String?,
        currentItemId: String?,
        lastError: String?
    ): Boolean {
        val payload = HealthPayload(
            deviceId, sessionToken, appVersion, osVersion, freeDiskBytes,
            memoryClassMb, networkType, manifestVersion, currentItemId, lastError
        )
        val result: HealthResult? = callRpc("report_device_health", payload)
        return result?.ok == true
    }

    // ── RPC: increment_device_playtime ──
    @Serializable
    private data class PlaytimePayload(
        @SerialName("p_device_id") val deviceId: String,
        @SerialName("p_hardware_id") val hardwareId: String,
        @SerialName("p_secret") val secret: String,
        @SerialName("p_seconds") val seconds: Int
    )

    suspend fun incrementDevicePlaytime(
        deviceId: String,
        hardwareId: String,
        secret: String,
        seconds: Int
    ): Boolean {
        val payload = PlaytimePayload(deviceId, hardwareId, secret, seconds)
        val result: Unit? = callRpc("increment_device_playtime", payload)
        return result != null
    }

    // ── RPC: unpair_player_device ──
    @Serializable
    private data class UnpairPayload(
        @SerialName("p_device_id") val deviceId: String,
        @SerialName("p_hardware_id") val hardwareId: String,
        @SerialName("p_secret") val secret: String
    )

    suspend fun unpairDevice(
        deviceId: String,
        hardwareId: String,
        secret: String
    ): Boolean {
        val payload = UnpairPayload(deviceId, hardwareId, secret)
        val result: Unit? = callRpc("unpair_player_device", payload)
        return result != null
    }

    // ── RPC: update_player_device_orientation ──
    @Serializable
    private data class OrientationPayload(
        @SerialName("p_device_id") val deviceId: String,
        @SerialName("p_hardware_id") val hardwareId: String,
        @SerialName("p_secret") val secret: String,
        @SerialName("p_orientation") val orientation: Int
    )

    suspend fun updatePlayerDeviceOrientation(
        deviceId: String,
        hardwareId: String,
        secret: String,
        orientation: Int
    ): Boolean {
        val payload = OrientationPayload(deviceId, hardwareId, secret, orientation)
        val result: Unit? = callRpc("update_player_device_orientation", payload)
        return result != null
    }

    // ── Physical File Downloader ──
    suspend fun downloadFile(url: String, outputFile: File): Boolean = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Downloading file from: $url to ${outputFile.absolutePath}")
            val request = Request.Builder().url(url).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.e(TAG, "Download failed with status: ${response.code}")
                    return@withContext false
                }

                val body = response.body ?: return@withContext false
                
                // Ensure parent directory exists
                outputFile.parentFile?.mkdirs()

                // Write stream to file
                body.byteStream().use { inputStream ->
                    FileOutputStream(outputFile).use { outputStream ->
                        val buffer = ByteArray(4096)
                        var bytesRead: Int
                        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                            outputStream.write(buffer, 0, bytesRead)
                        }
                        outputStream.flush()
                    }
                }
                Log.d(TAG, "Download completed successfully: ${outputFile.name}")
                return@withContext true
            }
        } catch (e: IOException) {
            Log.e(TAG, "IOException downloading file", e)
            false
        }
    }
}

@Serializable
data class SignedUrlResponse(val url: String)

