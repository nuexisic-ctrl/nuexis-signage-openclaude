package com.nuexis.player.data.remote

import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class RealtimeClient {

    companion object {
        private const val TAG = "RealtimeClient"
        private const val HEARTBEAT_INTERVAL_MS = 30000L
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val refCounter = AtomicInteger(1)
    
    private val connectionMutex = Mutex()
    
    var isConnected = false
        private set
        
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var heartbeatJob: Job? = null

    // Configuration state for rejoining channels on reconnect
    private var activeDeviceId: String? = null
    private var activeTeamId: String? = null
    private var activePlaylistId: String? = null
    private var activeSecret: String? = null
    private var activeSessionToken: String? = null
    
    // Unique session-based presence identifier
    private val presenceKey = UUID.randomUUID().toString()

    private var reconnectAttempts = 0
    private var reconnectJob: Job? = null

    // Reactive flow outputs for UI/ViewModel subscription
    private val _connectionState = MutableSharedFlow<Boolean>(extraBufferCapacity = 8)
    val connectionState: SharedFlow<Boolean> = _connectionState

    private val _deviceUpdates = MutableSharedFlow<JsonObject>(extraBufferCapacity = 64)
    val deviceUpdates: SharedFlow<JsonObject> = _deviceUpdates

    private val _playlistRefreshSignals = MutableSharedFlow<String>(extraBufferCapacity = 64)
    val playlistRefreshSignals: SharedFlow<String> = _playlistRefreshSignals

    fun connect(deviceId: String, teamId: String?, playlistId: String?, secret: String? = null, sessionToken: String? = null) {
        scope.launch {
            connectionMutex.withLock {
                activeDeviceId = deviceId
                activeTeamId = teamId
                activePlaylistId = playlistId
                activeSecret = secret
                activeSessionToken = sessionToken

                performConnect(deviceId, teamId, playlistId, secret, sessionToken)
            }
        }
    }

    private fun performConnect(deviceId: String, teamId: String?, playlistId: String?, secret: String?, sessionToken: String?) {
        if (webSocket != null) {
            performDisconnect()
        }

        val url = "${SupabaseApi.SUPABASE_URL}/realtime/v1/websocket?apikey=${SupabaseApi.SUPABASE_ANON_KEY}&vsn=1.0.0"
        val request = Request.Builder()
            .url(url)
            .addHeader("x-device-id", deviceId)
            .apply {
                if (secret != null) {
                    addHeader("x-device-secret", secret)
                }
                if (sessionToken != null) {
                    addHeader("x-device-token", sessionToken)
                }
            }
            .build()

        Log.d(TAG, "Connecting to WebSocket: $url")
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket Connection Opened")
                scope.launch {
                    connectionMutex.withLock {
                        isConnected = true
                        reconnectAttempts = 0
                        reconnectJob?.cancel()
                        reconnectJob = null
                        startHeartbeat()
                        
                        // Join Channels
                        joinDeviceChannel(deviceId)
                        teamId?.let { joinPresenceChannel(it, deviceId) }
                        playlistId?.let { joinPlaylistChannel(it) }

                        _connectionState.emit(true)
                    }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.v(TAG, "Received message: $text")
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket Closing: $code / $reason")
                scope.launch {
                    connectionMutex.withLock {
                        isConnected = false
                        _connectionState.emit(false)
                    }
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket Closed: $code / $reason")
                scope.launch {
                    connectionMutex.withLock {
                        isConnected = false
                        stopHeartbeat()
                        _connectionState.emit(false)
                        reconnectDelay()
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket Failure", t)
                scope.launch {
                    connectionMutex.withLock {
                        isConnected = false
                        stopHeartbeat()
                        _connectionState.emit(false)
                        reconnectDelay()
                    }
                }
            }
        })
    }

    fun updatePlaylistSubscription(newPlaylistId: String?) {
        scope.launch {
            connectionMutex.withLock {
                val oldPlaylistId = activePlaylistId
                activePlaylistId = newPlaylistId

                if (isConnected) {
                    // Leave old channel if it exists
                    oldPlaylistId?.let { leavePlaylistChannel(it) }
                    // Join new channel if it exists
                    newPlaylistId?.let { joinPlaylistChannel(it) }
                }
            }
        }
    }

    fun disconnect() {
        scope.launch {
            connectionMutex.withLock {
                performDisconnect()
            }
        }
    }

    fun destroy() {
        disconnect()
        scope.cancel()
    }

    private fun performDisconnect() {
        Log.d(TAG, "Disconnecting WebSocket")
        stopHeartbeat()
        reconnectJob?.cancel()
        reconnectJob = null
        webSocket?.close(1000, "App Disconnect")
        webSocket = null
        isConnected = false
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive && isConnected) {
                delay(HEARTBEAT_INTERVAL_MS)
                sendHeartbeat()
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private fun reconnectDelay() {
        scope.launch {
            connectionMutex.withLock {
                if (isConnected || reconnectJob?.isActive == true) return@withLock

                reconnectJob?.cancel()
                reconnectJob = scope.launch {
                    val delayMs = Math.min(60000L, 2000L * Math.pow(2.0, reconnectAttempts.toDouble()).toLong())
                    Log.d(TAG, "Scheduling WebSocket reconnect in ${delayMs}ms (attempt $reconnectAttempts)")
                    delay(delayMs)
                    
                    connectionMutex.withLock {
                        reconnectAttempts++
                        val devId = activeDeviceId
                        if (devId != null && !isConnected) {
                            Log.d(TAG, "Attempting to reconnect WebSocket...")
                            performConnect(devId, activeTeamId, activePlaylistId, activeSecret, activeSessionToken)
                        }
                    }
                }
            }
        }
    }

    private fun sendHeartbeat() {
        val ref = "H_${refCounter.getAndIncrement()}"
        val msg = buildMessageJson("phoenix", "heartbeat", buildJsonObject {}, ref)
        sendMessage(msg)
    }

    private fun joinDeviceChannel(deviceId: String) {
        val ref = "J_${refCounter.getAndIncrement()}"
        val topic = "realtime:device-pair-$deviceId"
        val payload = buildJsonObject {
            putJsonObject("config") {
                putJsonArray("postgres_changes") {
                    addJsonObject {
                        put("event", "*")
                        put("schema", "public")
                        put("table", "devices")
                        put("filter", "id=eq.$deviceId")
                    }
                }
            }
        }
        val msg = buildMessageJson(topic, "phx_join", payload, ref)
        Log.d(TAG, "Joining device changes channel: $topic")
        sendMessage(msg)
    }

    private fun joinPresenceChannel(teamId: String, deviceId: String) {
        val ref = "J_${refCounter.getAndIncrement()}"
        val topic = "realtime:team-status:$teamId"
        
        // Pass presence key configuration in phx_join message payload to tell Supabase server how to track our presence
        val payload = buildJsonObject {
            putJsonObject("config") {
                putJsonObject("presence") {
                    put("key", "$deviceId:$presenceKey")
                }
            }
        }
        val msg = buildMessageJson(topic, "phx_join", payload, ref)
        Log.d(TAG, "Joining presence channel: $topic with presence key: $deviceId:$presenceKey")
        sendMessage(msg)

        // Then send presence_track message
        trackPresence(teamId, deviceId)
    }

    private fun trackPresence(teamId: String, deviceId: String) {
        val ref = "P_${refCounter.getAndIncrement()}"
        val topic = "realtime:team-status:$teamId"
        
        val isoTimestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        
        val payload = buildJsonObject {
            put("device_id", deviceId)
            put("online_at", isoTimestamp)
        }
        val msg = buildMessageJson(topic, "presence_track", payload, ref)
        Log.d(TAG, "Sending presence_track for device: $deviceId on topic: $topic")
        sendMessage(msg)
    }

    private fun joinPlaylistChannel(playlistId: String) {
        val ref = "J_${refCounter.getAndIncrement()}"
        val topic = "realtime:playlist-broadcast-$playlistId"
        val msg = buildMessageJson(topic, "phx_join", buildJsonObject {}, ref)
        Log.d(TAG, "Joining playlist broadcast channel: $topic")
        sendMessage(msg)
    }

    private fun leavePlaylistChannel(playlistId: String) {
        val ref = "L_${refCounter.getAndIncrement()}"
        val topic = "realtime:playlist-broadcast-$playlistId"
        val msg = buildMessageJson(topic, "phx_leave", buildJsonObject {}, ref)
        Log.d(TAG, "Leaving playlist broadcast channel: $topic")
        sendMessage(msg)
    }

    private fun sendMessage(jsonString: String) {
        if (isConnected) {
            webSocket?.send(jsonString)
        } else {
            Log.w(TAG, "Cannot send message, WebSocket not connected")
        }
    }

    private fun buildMessageJson(topic: String, event: String, payload: JsonObject, ref: String): String {
        val jsonMsg = buildJsonObject {
            put("topic", topic)
            put("event", event)
            put("payload", payload)
            put("ref", ref)
        }
        return json.encodeToString(jsonMsg)
    }

    private fun handleMessage(text: String) {
        try {
            val root = json.parseToJsonElement(text).jsonObject
            val topic = root["topic"]?.jsonPrimitive?.content ?: ""
            val event = root["event"]?.jsonPrimitive?.content ?: ""
            val payload = root["payload"]?.jsonObject ?: buildJsonObject {}

            when {
                // Handle Device DB updates
                topic.startsWith("realtime:device-pair-") && event == "postgres_changes" -> {
                    val dataObj = payload["data"] as? JsonObject
                    val eventType = dataObj?.get("type")?.jsonPrimitive?.content
                    val record = if (eventType == "DELETE") {
                        buildJsonObject { put("is_deleted", true) }
                    } else {
                        dataObj?.get("record") as? JsonObject
                            ?: dataObj?.get("new") as? JsonObject
                            ?: payload["new"] as? JsonObject
                            ?: payload["record"] as? JsonObject
                    }
                    if (record != null) {
                        Log.d(TAG, "Received device record update (event=$eventType): $record")
                        scope.launch {
                            _deviceUpdates.emit(record)
                        }
                    }
                }

                // Handle Playlist Broadcast refresh
                topic.startsWith("realtime:playlist-broadcast-") && event == "broadcast" -> {
                    val broadcastEvent = payload["event"]?.jsonPrimitive?.content ?: ""
                    Log.d(TAG, "Received broadcast event: $broadcastEvent")
                    if (broadcastEvent == "refresh") {
                        val playlistId = topic.substringAfter("realtime:playlist-broadcast-")
                        scope.launch {
                            _playlistRefreshSignals.emit(playlistId)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing incoming socket message: $text", e)
        }
    }
}
