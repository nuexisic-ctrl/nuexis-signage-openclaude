package com.nuexis.player.network

import com.nuexis.player.config.PlayerConfig
import com.nuexis.player.data.DeviceSessionResponse
import com.nuexis.player.data.DeviceStateResponse
import com.nuexis.player.data.HealthEventRequest
import com.nuexis.player.data.MediaUrlRequest
import com.nuexis.player.data.MediaUrlResponse
import com.nuexis.player.data.PlaybackEventRequest
import com.nuexis.player.data.PlayerManifest
import com.nuexis.player.data.RegisterDeviceResponse
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.Json

class SupabaseGateway(
    private val client: HttpClient = defaultHttpClient()
) {
    @Suppress("unused")
    val supabaseClient = createSupabaseClient(
        supabaseUrl = PlayerConfig.supabaseUrl,
        supabaseKey = PlayerConfig.supabasePublishableKey
    ) {
        install(Postgrest)
        install(Realtime)
    }

    suspend fun registerDevice(hardwareId: String, pairingCode: String, expiresAtIso: String): RegisterDeviceResponse {
        return rpc("register_player_device", RegisterDeviceRequest(hardwareId, pairingCode, expiresAtIso))
    }

    suspend fun refreshPairingCode(
        deviceId: String,
        hardwareId: String,
        secret: String,
        pairingCode: String,
        expiresAtIso: String
    ): RegisterDeviceResponse {
        return rpc("refresh_player_device_code", RefreshDeviceRequest(deviceId, hardwareId, secret, pairingCode, expiresAtIso))
    }

    suspend fun getDeviceState(hardwareId: String, secret: String?): DeviceStateResponse? {
        return rpcNullable("get_player_device_state", DeviceStateRequest(hardwareId, secret))
    }

    suspend fun exchangeSession(deviceId: String, hardwareId: String, secret: String): DeviceSessionResponse {
        return rpc("exchange_device_secret_for_session", ExchangeSessionRequest(deviceId, hardwareId, secret))
    }

    suspend fun getManifest(deviceId: String, sessionToken: String): PlayerManifest {
        return rpc("get_player_manifest", SessionRequest(deviceId, sessionToken))
    }

    suspend fun reportPlayback(event: PlaybackEventRequest) {
        rpc<RpcOk, PlaybackEventRequest>("report_playback_event", event)
    }

    suspend fun reportHealth(event: HealthEventRequest) {
        rpc<RpcOk, HealthEventRequest>("report_device_health", event)
    }

    suspend fun incrementPlaytime(deviceId: String, sessionToken: String, seconds: Int) {
        rpc<RpcOk, PlaytimeRequest>("increment_device_playtime", PlaytimeRequest(deviceId, sessionToken, seconds))
    }

    suspend fun getSignedMediaUrl(deviceId: String, sessionToken: String, filePath: String): String {
        val response = client.post("${PlayerConfig.playerApiBaseUrl}/api/player/media-url") {
            secureHeaders()
            setBody(MediaUrlRequest(deviceId, sessionToken, filePath))
        }
        if (response.status != HttpStatusCode.OK) {
            throw IllegalStateException("Media signing failed: ${response.status}")
        }
        return response.body<MediaUrlResponse>().signedUrl
    }

    private suspend inline fun <reified T, reified B : Any> rpc(functionName: String, body: B): T {
        val response = client.post("${PlayerConfig.supabaseUrl}/rest/v1/rpc/$functionName") {
            secureHeaders()
            setBody(body)
        }
        if (response.status.value !in 200..299) {
            throw IllegalStateException("RPC $functionName failed: ${response.status}")
        }
        return response.body()
    }

    private suspend inline fun <reified T, reified B : Any> rpcNullable(functionName: String, body: B): T? {
        val response = client.post("${PlayerConfig.supabaseUrl}/rest/v1/rpc/$functionName") {
            secureHeaders()
            setBody(body)
        }
        if (response.status == HttpStatusCode.NoContent) return null
        if (response.status.value !in 200..299) {
            throw IllegalStateException("RPC $functionName failed: ${response.status}")
        }
        return response.body()
    }

    private fun io.ktor.client.request.HttpRequestBuilder.secureHeaders() {
        contentType(ContentType.Application.Json)
        header("apikey", PlayerConfig.supabasePublishableKey)
        header(HttpHeaders.Authorization, "Bearer ${PlayerConfig.supabasePublishableKey}")
    }

    companion object {
        val json = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        fun defaultHttpClient(): HttpClient = HttpClient(Android) {
            install(ContentNegotiation) { json(json) }
            install(WebSockets)
        }
    }
}

@Serializable
private data class RegisterDeviceRequest(
    @SerialName("p_hardware_id") val hardwareId: String,
    @SerialName("p_pairing_code") val pairingCode: String,
    @SerialName("p_expires_at") val expiresAt: String
)

@Serializable
private data class RefreshDeviceRequest(
    @SerialName("p_device_id") val deviceId: String,
    @SerialName("p_hardware_id") val hardwareId: String,
    @SerialName("p_secret") val secret: String,
    @SerialName("p_pairing_code") val pairingCode: String,
    @SerialName("p_expires_at") val expiresAt: String
)

@Serializable
private data class DeviceStateRequest(
    @SerialName("p_hardware_id") val hardwareId: String,
    @SerialName("p_secret") val secret: String? = null
)

@Serializable
private data class ExchangeSessionRequest(
    @SerialName("p_device_id") val deviceId: String,
    @SerialName("p_hardware_id") val hardwareId: String,
    @SerialName("p_secret") val secret: String
)

@Serializable
private data class SessionRequest(
    @SerialName("p_device_id") val deviceId: String,
    @SerialName("p_session_token") val sessionToken: String
)

@Serializable
private data class PlaytimeRequest(
    @SerialName("p_device_id") val deviceId: String,
    @SerialName("p_session_token") val sessionToken: String,
    @SerialName("p_seconds") val seconds: Int
)

@Serializable
private data class RpcOk(val ok: Boolean? = null)
