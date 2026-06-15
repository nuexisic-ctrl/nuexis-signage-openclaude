package com.nuexis.player.data

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SupabaseClient(
    private val baseUrl: String,
    private val anonKey: String
) {
    private val client = OkHttpClient()
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun getISO8601String(date: Date): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(date)
    }

    private fun post(rpcName: String, bodyJson: String): String {
        val url = "$baseUrl/rest/v1/rpc/$rpcName"
        val requestBody = bodyJson.toRequestBody(jsonMediaType)
        
        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                val errBody = response.body?.string() ?: ""
                throw IOException("Supabase RPC $rpcName failed with status ${response.code}: $errBody")
            }
            return response.body?.string() ?: ""
        }
    }

    // Models for responses
    data class RegistrationResult(
        val id: String,
        val expires_at: String,
        val secret: String,
        val pairing_code: String
    )

    data class SessionResult(
        val device_id: String,
        val team_id: String,
        val session_token: String,
        val expires_at: String,
        val manifest: JsonObject?
    )

    data class RefreshResult(
        val id: String,
        val expires_at: String
    )

    data class DeviceState(
        val id: String,
        val team_id: String?,
        val name: String?,
        val pairing_code: String,
        val expires_at: String,
        val status: String,
        val content_type: String?,
        val asset_id: String?,
        val playlist_id: String?,
        val orientation: Int?,
        val scale_mode: String?,
        val updated_at: String?
    )

    data class PlaylistItem(
        val id: String,
        val playlist_id: String?,
        val type: String,
        val asset_id: String?,
        val widget_type: String?,
        val widget_config: JsonObject?,
        val duration_seconds: Int,
        val sort_order: Int,
        val assets: AssetInfo?
    )

    data class AssetInfo(
        val file_path: String,
        val mime_type: String
    )

    fun registerDevice(hardwareId: String, pairingCode: String, expiresAt: Long): RegistrationResult {
        val params = JsonObject().apply {
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_pairing_code", pairingCode)
            addProperty("p_expires_at", getISO8601String(Date(expiresAt)))
        }
        val response = post("register_player_device", gson.toJson(params))
        return gson.fromJson(response, RegistrationResult::class.java)
    }

    fun refreshDeviceCode(
        deviceId: String,
        hardwareId: String,
        secret: String,
        pairingCode: String,
        expiresAt: Long
    ): RefreshResult {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
            addProperty("p_pairing_code", pairingCode)
            addProperty("p_expires_at", getISO8601String(Date(expiresAt)))
        }
        val response = post("refresh_player_device_code", gson.toJson(params))
        return gson.fromJson(response, RefreshResult::class.java)
    }

    sealed class DeviceStateResult {
        data class Success(val state: DeviceState?) : DeviceStateResult()
        data class Error(val exception: Exception) : DeviceStateResult()
    }

    fun getDeviceState(hardwareId: String, secret: String?): DeviceStateResult {
        val params = JsonObject().apply {
            addProperty("p_hardware_id", hardwareId)
            if (secret != null) {
                addProperty("p_secret", secret)
            }
        }
        return try {
            val response = post("get_player_device_state", gson.toJson(params))
            val state = if (response == "null" || response.trim().isEmpty()) {
                null
            } else {
                gson.fromJson(response, DeviceState::class.java)
            }
            DeviceStateResult.Success(state)
        } catch (e: Exception) {
            DeviceStateResult.Error(e)
        }
    }

    fun unpairDevice(deviceId: String, hardwareId: String, secret: String) {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
        }
        post("unpair_player_device", gson.toJson(params))
    }

    fun updateDeviceOrientation(deviceId: String, hardwareId: String, secret: String, orientation: Int) {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
            addProperty("p_orientation", orientation)
        }
        post("update_player_device_orientation", gson.toJson(params))
    }

    fun incrementPlaytime(deviceId: String, hardwareId: String, secret: String, seconds: Int) {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
            addProperty("p_seconds", seconds)
        }
        try {
            post("increment_device_playtime", gson.toJson(params))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getPlaylistItems(playlistId: String, hardwareId: String, secret: String): List<PlaylistItem> {
        val params = JsonObject().apply {
            addProperty("p_playlist_id", playlistId)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
        }
        val response = post("get_player_playlist_items", gson.toJson(params))
        val type = object : TypeToken<List<PlaylistItem>>() {}.type
        return gson.fromJson(response, type) ?: emptyList()
    }

    fun getSignedMediaUrl(filePath: String, hardwareId: String, secret: String): String {
        val params = JsonObject().apply {
            addProperty("p_file_path", filePath)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
        }
        val response = post("get_player_signed_media_url", gson.toJson(params))
        return gson.fromJson(response, String::class.java) ?: filePath
    }

    fun getPlayerAsset(assetId: String, hardwareId: String, secret: String): AssetInfo? {
        val params = JsonObject().apply {
            addProperty("p_asset_id", assetId)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
        }
        return try {
            val response = post("get_player_asset", gson.toJson(params))
            if (response == "null" || response.trim().isEmpty()) {
                null
            } else {
                gson.fromJson(response, AssetInfo::class.java)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun exchangeDeviceSecretForSession(
        deviceId: String,
        hardwareId: String,
        secret: String
    ): SessionResult {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_hardware_id", hardwareId)
            addProperty("p_secret", secret)
        }
        val response = post("exchange_device_secret_for_session", gson.toJson(params))
        return gson.fromJson(response, SessionResult::class.java)
    }

    fun reportPlaybackEvent(
        deviceId: String,
        sessionToken: String,
        eventType: String,
        itemId: String?,
        assetId: String?,
        positionMs: Long,
        durationMs: Long,
        cacheStatus: String?,
        errorMessage: String?
    ) {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_session_token", sessionToken)
            addProperty("p_event_type", eventType)
            if (itemId != null) addProperty("p_item_id", itemId)
            if (assetId != null) addProperty("p_asset_id", assetId)
            addProperty("p_position_ms", positionMs)
            addProperty("p_duration_ms", durationMs)
            if (cacheStatus != null) addProperty("p_cache_status", cacheStatus)
            if (errorMessage != null) addProperty("p_error_message", errorMessage)
        }
        try {
            post("report_playback_event", gson.toJson(params))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun reportDeviceHealth(
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
    ) {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_session_token", sessionToken)
            if (appVersion != null) addProperty("p_app_version", appVersion)
            if (osVersion != null) addProperty("p_os_version", osVersion)
            if (freeDiskBytes != null) addProperty("p_free_disk_bytes", freeDiskBytes)
            if (memoryClassMb != null) addProperty("p_memory_class_mb", memoryClassMb)
            if (networkType != null) addProperty("p_network_type", networkType)
            if (manifestVersion != null) addProperty("p_manifest_version", manifestVersion)
            if (currentItemId != null) addProperty("p_current_item_id", currentItemId)
            if (lastError != null) addProperty("p_last_error", lastError)
        }
        try {
            post("report_device_health", gson.toJson(params))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun pingDevice(deviceId: String, sessionToken: String) {
        val params = JsonObject().apply {
            addProperty("p_device_id", deviceId)
            addProperty("p_session_token", sessionToken)
        }
        try {
            post("ping_device", gson.toJson(params))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
