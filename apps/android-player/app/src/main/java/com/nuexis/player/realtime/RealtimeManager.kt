package com.nuexis.player.realtime

import com.nuexis.player.config.PlayerConfig
import com.nuexis.player.network.SupabaseGateway
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.HttpClient
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.http.URLProtocol
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.atomic.AtomicInteger

class RealtimeManager(
    private val scope: CoroutineScope,
    private val client: HttpClient = SupabaseGateway.defaultHttpClient(),
    private val onManifestRefresh: suspend () -> Unit,
    private val onReconnectState: (Boolean) -> Unit
) {
    private var job: Job? = null
    private val ref = AtomicInteger(1)

    fun start(deviceId: String, teamId: String, sessionToken: String, manifestVersion: String?) {
        stop()
        job = scope.launch {
            var delayMs = 1_000L
            while (isActive) {
                try {
                    connect(deviceId, teamId, sessionToken, manifestVersion)
                    delayMs = 1_000L
                } catch (_: Throwable) {
                    onReconnectState(false)
                    delay(delayMs)
                    delayMs = (delayMs * 2).coerceAtMost(30_000L)
                }
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private suspend fun connect(deviceId: String, teamId: String, sessionToken: String, manifestVersion: String?) {
        val host = PlayerConfig.supabaseUrl.removePrefix("https://").removePrefix("http://")
        client.webSocket({
            url {
                protocol = URLProtocol.WSS
                this.host = host
                encodedPath = "/realtime/v1/websocket"
                parameters.append("apikey", PlayerConfig.supabasePublishableKey)
                parameters.append("vsn", "1.0.0")
            }
        }) {
            val deviceTopic = "realtime:device:$deviceId"
            val teamTopic = "realtime:team-status:$teamId"
            sendJoin(deviceTopic, deviceId = deviceId)
            sendJoin(teamTopic, presenceKey = "$deviceId:$sessionToken")
            trackPresence(teamTopic, deviceId, manifestVersion)
            onReconnectState(true)

            val heartbeat = launch {
                while (isActive) {
                    sendPhoenix("phoenix", "heartbeat", JsonObject(emptyMap()))
                    delay(25_000)
                }
            }

            try {
                for (frame in incoming) {
                    if (frame is Frame.Text) {
                        val text = frame.readText()
                        if (text.contains("\"event\":\"postgres_changes\"") ||
                            text.contains("\"event\":\"broadcast\"") ||
                            text.contains("\"event\":\"refresh\"")
                        ) {
                            onManifestRefresh()
                        }
                    }
                }
            } finally {
                heartbeat.cancel()
                onReconnectState(false)
            }
        }
    }

    private suspend fun DefaultClientWebSocketSession.sendJoin(
        topic: String,
        presenceKey: String? = null,
        deviceId: String? = null
    ) {
        val payload = buildJsonObject {
            put("config", buildJsonObject {
                put("broadcast", buildJsonObject {
                    put("self", false)
                    put("ack", false)
                })
                if (deviceId != null) {
                    put("postgres_changes", JsonArray(listOf(buildJsonObject {
                        put("event", "*")
                        put("schema", "public")
                        put("table", "devices")
                        put("filter", "id=eq.$deviceId")
                    })))
                } else {
                    put("postgres_changes", JsonArray(emptyList()))
                }
                if (presenceKey != null) {
                    put("presence", buildJsonObject { put("key", presenceKey) })
                }
            })
        }
        sendPhoenix(topic, "phx_join", payload)
    }

    private suspend fun DefaultClientWebSocketSession.trackPresence(
        topic: String,
        deviceId: String,
        manifestVersion: String?
    ) {
        val payload = buildJsonObject {
            put("type", "presence")
            put("event", "track")
            put("payload", buildJsonObject {
                put("device_id", deviceId)
                put("online_at", System.currentTimeMillis())
                if (manifestVersion != null) put("manifest_version", manifestVersion)
            })
        }
        sendPhoenix(topic, "presence", payload)
    }

    private suspend fun DefaultClientWebSocketSession.sendPhoenix(
        topic: String,
        event: String,
        payload: JsonObject
    ) {
        val message = buildJsonObject {
            put("topic", topic)
            put("event", event)
            put("payload", payload)
            put("ref", ref.getAndIncrement().toString())
        }
        send(Frame.Text(SupabaseGateway.json.encodeToString(message)))
    }
}
