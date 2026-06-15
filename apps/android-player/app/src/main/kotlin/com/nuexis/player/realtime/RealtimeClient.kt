package com.nuexis.player.realtime

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import okhttp3.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.TimeUnit

class RealtimeClient(
    private val baseUrl: String,
    private val anonKey: String,
    private val deviceId: String,
    private val presenceKey: String,
    private val listener: RealtimeListener
) {
    interface RealtimeListener {
        fun onDeviceUpdated(record: JsonObject)
        fun onDeviceDeleted()
        fun onPlaylistRefresh()
        fun onScreenshotRequested(backendUrl: String?)
        fun onError(t: Throwable)
        fun onConnected()
        fun onDisconnected()
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()
    private var webSocket: WebSocket? = null
    private val gson = Gson()
    private var isClosed = false
    private var heartbeatThread: Thread? = null
    private var teamId: String? = null
    private var activePlaylistId: String? = null

    @Volatile
    private var isConnected = false

    @Volatile
    private var isConnecting = false

    fun isConnected(): Boolean = isConnected

    private fun getISO8601String(date: Date): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(date)
    }

    fun connect() {
        if (isClosed) return
        if (isConnected || isConnecting) {
            android.util.Log.d("RealtimeClient", "Already connected or connecting. Skipping connect.")
            return
        }
        isConnecting = true
        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://") +
                "/realtime/v1/websocket?apikey=$anonKey&vsn=1.0.0"

        val request = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnecting = false
                isConnected = true
                if (isClosed) {
                    webSocket.close(1000, "Closed")
                    return
                }
                listener.onConnected()
                joinDeviceChannel()
                joinDevicePairChannel()
                startHeartbeat()
                
                // If we already had a teamId set, rejoin presence channel
                val currentTeamId = teamId
                if (currentTeamId != null) {
                    joinPresenceChannel(currentTeamId)
                }
                val currentPlaylistId = activePlaylistId
                if (currentPlaylistId != null) {
                    joinPlaylistChannel(currentPlaylistId)
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (isClosed) return
                try {
                    val root = JsonParser.parseString(text).asJsonObject
                    val event = root.get("event")?.asString
                    val topic = root.get("topic")?.asString
                    val payload = root.getAsJsonObject("payload")
                    
                    if (event == "postgres_changes" && payload != null) {
                        val changeEvent = payload.get("event")?.asString
                        if (changeEvent == "DELETE") {
                            listener.onDeviceDeleted()
                        } else {
                            val data = payload.getAsJsonObject("data")
                            if (data != null) {
                                val record = data.getAsJsonObject("record")
                                if (record != null) {
                                    listener.onDeviceUpdated(record)
                                }
                            }
                        }
                    } else if (event == "refresh" && (topic?.startsWith("realtime:playlist-broadcast-") == true || topic?.startsWith("playlist-broadcast-") == true)) {
                        listener.onPlaylistRefresh()
                    } else if (event == "request_screenshot" && (topic?.startsWith("realtime:device-pair-") == true || topic?.startsWith("device-pair-") == true)) {
                        val backendUrl = payload?.get("backendUrl")?.asString
                        listener.onScreenshotRequested(backendUrl)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                isConnecting = false
                isConnected = false
                if (isClosed) return
                listener.onError(t)
                reconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnecting = false
                isConnected = false
                if (isClosed) return
                listener.onDisconnected()
                reconnect()
            }
        })
    }

    private fun joinDeviceChannel() {
        val topic = "realtime:public:devices:id=eq.$deviceId"
        val config = JsonObject().apply {
            val postgresChanges = com.google.gson.JsonArray().apply {
                add(JsonObject().apply {
                    addProperty("event", "*")
                    addProperty("schema", "public")
                    addProperty("table", "devices")
                    addProperty("filter", "id=eq.$deviceId")
                })
            }
            add("postgres_changes", postgresChanges)
        }
        
        val payload = JsonObject().apply {
            add("config", config)
        }

        val joinMsg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "phx_join")
            add("payload", payload)
            addProperty("ref", "1")
        }

        webSocket?.send(gson.toJson(joinMsg))
    }

    private fun joinDevicePairChannel() {
        val topic = "realtime:device-pair-$deviceId"
        val joinMsg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "phx_join")
            add("payload", JsonObject())
            addProperty("ref", "join_device_pair")
        }
        webSocket?.send(gson.toJson(joinMsg))
    }

    fun startPresence(teamId: String) {
        this.teamId = teamId
        joinPresenceChannel(teamId)
    }

    fun startPlaylistSubscription(playlistId: String) {
        val oldPlaylistId = activePlaylistId
        if (oldPlaylistId == playlistId) return
        
        if (oldPlaylistId != null) {
            leaveChannel("realtime:playlist-broadcast-$oldPlaylistId")
        }
        activePlaylistId = playlistId
        joinPlaylistChannel(playlistId)
    }

    private fun joinPlaylistChannel(playlistId: String) {
        val topic = "realtime:playlist-broadcast-$playlistId"
        val joinMsg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "phx_join")
            add("payload", JsonObject())
            addProperty("ref", "join_playlist_$playlistId")
        }
        webSocket?.send(gson.toJson(joinMsg))
    }

    private fun leaveChannel(topic: String) {
        val leaveMsg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "phx_leave")
            add("payload", JsonObject())
            addProperty("ref", "leave_$topic")
        }
        webSocket?.send(gson.toJson(leaveMsg))
    }

    private fun joinPresenceChannel(teamId: String) {
        val topic = "realtime:team-status:$teamId"
        val config = JsonObject().apply {
            add("presence", JsonObject().apply {
                addProperty("key", "$deviceId:$presenceKey")
                addProperty("enabled", true)
            })
        }
        val payload = JsonObject().apply {
            add("config", config)
        }
        val joinMsg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "phx_join")
            add("payload", payload)
            addProperty("ref", "join_presence")
        }
        webSocket?.send(gson.toJson(joinMsg))

        // Immediately track ourselves (Supabase Realtime Presence Protocol)
        val presenceTrackPayload = JsonObject().apply {
            addProperty("type", "presence")
            addProperty("event", "track")
            add("payload", JsonObject().apply {
                addProperty("device_id", deviceId)
                addProperty("online_at", getISO8601String(Date()))
            })
        }
        val trackMsg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "presence")
            add("payload", presenceTrackPayload)
            addProperty("ref", "track_presence")
        }
        webSocket?.send(gson.toJson(trackMsg))
    }

    private fun startHeartbeat() {
        heartbeatThread?.interrupt()
        heartbeatThread = Thread {
            var ref = 2
            try {
                while (!Thread.currentThread().isInterrupted && !isClosed) {
                    Thread.sleep(30000)
                    val heartbeatMsg = JsonObject().apply {
                        addProperty("topic", "phoenix")
                        addProperty("event", "heartbeat")
                        add("payload", JsonObject())
                        addProperty("ref", ref.toString())
                    }
                    webSocket?.send(gson.toJson(heartbeatMsg))
                    ref++

                    // Re-track presence periodically to maintain online status (Supabase Realtime Presence Protocol)
                    val currentTeamId = teamId
                    if (currentTeamId != null) {
                        val presenceTrackPayload = JsonObject().apply {
                            addProperty("type", "presence")
                            addProperty("event", "track")
                            add("payload", JsonObject().apply {
                                addProperty("device_id", deviceId)
                                addProperty("online_at", getISO8601String(Date()))
                            })
                        }
                        val trackMsg = JsonObject().apply {
                            addProperty("topic", "realtime:team-status:$currentTeamId")
                            addProperty("event", "presence")
                            add("payload", presenceTrackPayload)
                            addProperty("ref", "track_presence_$ref")
                        }
                        webSocket?.send(gson.toJson(trackMsg))
                    }
                }
            } catch (e: InterruptedException) {
                // Exit thread
            }
        }.apply { isDaemon = true; start() }
    }

    fun refreshPresence() {
        val currentTeamId = teamId
        if (currentTeamId != null && isConnected) {
            android.util.Log.d("RealtimeClient", "Refreshing presence track manually.")
            joinPresenceChannel(currentTeamId)
        }
    }

    private fun reconnect() {
        if (isClosed) return
        cleanup()
        Thread {
            try {
                Thread.sleep(5000)
                if (!isClosed) {
                    connect()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun cleanup() {
        heartbeatThread?.interrupt()
        heartbeatThread = null
        isConnected = false
        isConnecting = false
        try {
            webSocket?.close(1000, "Reconnecting")
        } catch (e: Exception) {
            // Ignore
        }
        webSocket = null
    }

    fun disconnect() {
        isClosed = true
        cleanup()
    }
}
