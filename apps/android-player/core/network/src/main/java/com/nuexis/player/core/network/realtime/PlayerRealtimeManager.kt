package com.nuexis.player.core.network.realtime

import android.content.Context
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.nuexis.player.core.domain.realtime.PlayerRealtimeSession
import com.nuexis.player.core.domain.realtime.RealtimeSyncTrigger
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeRecord
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlayerRealtimeManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val supabase: SupabaseClient,
    private val syncTrigger: RealtimeSyncTrigger
) {
    private val scope = CoroutineScope(SupervisorJob() + kotlinx.coroutines.Dispatchers.IO)
    private val sessionMutex = Mutex()

    private var currentSession: PlayerRealtimeSession? = null
    private var devicePairChannel: RealtimeChannel? = null
    private var presenceChannel: RealtimeChannel? = null
    private var playlistChannel: RealtimeChannel? = null

    private var presenceRetrackJob: Job? = null
    private var reconnectJob: Job? = null
    private var realtimeStatusJob: Job? = null
    private var reconnectAttempt = 0

    private val presencePrefs by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "realtime_presence_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    init {
        realtimeStatusJob = scope.launch {
            supabase.realtime.status
                .drop(1)
                .collect { status ->
                    if (status == Realtime.Status.DISCONNECTED && currentSession != null) {
                        Log.w(TAG, "Realtime socket disconnected — reconnecting")
                        scheduleReconnect()
                    }
                }
        }
    }

    fun start(session: PlayerRealtimeSession) {
        scope.launch {
            sessionMutex.withLock {
                if (currentSession == session && devicePairChannel != null) {
                    Log.d(TAG, "Realtime already active for device ${session.deviceId}")
                    return@withLock
                }
                presenceRetrackJob?.cancel()
                reconnectJob?.cancel()
                teardownChannels()
                currentSession = session
                reconnectAttempt = 0
            }
            runCatching {
                syncTrigger.onSyncRequested("initial")
            }.onFailure { Log.e(TAG, "Initial sync failed", it) }
            connectChannels(session)
        }
    }

    fun updateSession(session: PlayerRealtimeSession) {
        val previous = currentSession
        if (previous?.deviceId == session.deviceId &&
            previous.teamId == session.teamId &&
            previous.playlistId == session.playlistId &&
            devicePairChannel != null
        ) {
            return
        }
        start(session)
    }

    fun reconnectIfNeeded() {
        val session = currentSession ?: return
        scope.launch {
            val needsReconnect = sessionMutex.withLock {
                devicePairChannel == null || presenceChannel == null
            }
            if (needsReconnect) {
                Log.i(TAG, "Reconnecting realtime channels")
                connectChannels(session)
            } else {
                runCatching { trackPresence(session) }
                    .onFailure { Log.w(TAG, "Presence re-track on resume failed", it) }
            }
        }
    }

    fun stop() {
        scope.launch {
            sessionMutex.withLock {
                presenceRetrackJob?.cancel()
                reconnectJob?.cancel()
                teardownChannels()
                currentSession = null
            }
        }
    }

    private suspend fun connectChannels(session: PlayerRealtimeSession) {
        runCatching {
            teardownChannels()
            subscribeDevicePair(session)
            subscribePresence(session)
            session.playlistId?.let { subscribePlaylistBroadcast(it) }
            reconnectAttempt = 0
            Log.i(TAG, "Realtime channels connected for device=${session.deviceId}")
        }.onFailure { error ->
            Log.e(TAG, "Failed to connect realtime channels", error)
            scheduleReconnect()
        }
    }

    private suspend fun subscribeDevicePair(session: PlayerRealtimeSession) {
        val channel = supabase.channel("device-pair-${session.deviceId}")
        devicePairChannel = channel

        channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "devices"
            filter = "id=eq.${session.deviceId}"
        }.onEach { action ->
            when (action) {
                is PostgresAction.Delete -> {
                    Log.i(TAG, "Device row deleted — unpaired")
                    syncTrigger.onDeviceUnpaired()
                    stop()
                }
                is PostgresAction.Update -> {
                    val row = runCatching { action.decodeRecord<DeviceRealtimeRow>() }.getOrNull()
                    if (row?.teamId == null) {
                        Log.i(TAG, "Device unpaired (team_id cleared)")
                        syncTrigger.onDeviceUnpaired()
                        stop()
                        return@onEach
                    }
                    Log.d(TAG, "Device postgres UPDATE — syncing")
                    syncTrigger.onSyncRequested("device-pair")
                    row.playlistId?.let { newPlaylistId ->
                        val current = currentSession
                        if (current != null && current.playlistId != newPlaylistId) {
                            updatePlaylistChannel(newPlaylistId)
                        }
                    }
                }
                is PostgresAction.Insert -> {
                    syncTrigger.onSyncRequested("device-pair-insert")
                }
                else -> Unit
            }
        }.catch { e -> Log.e(TAG, "device-pair flow error", e) }
            .launchIn(scope)

        watchChannelStatus(channel, "device-pair")
        channel.subscribe(blockUntilSubscribed = true)
        Log.i(TAG, "device-pair channel SUBSCRIBED")
    }

    private suspend fun subscribePresence(session: PlayerRealtimeSession) {
        val presenceKey = getOrCreatePresenceKey()
        val channel = supabase.channel("team-status:${session.teamId}") {
            presence {
                key = "${session.deviceId}:$presenceKey"
            }
        }
        presenceChannel = channel

        watchChannelStatus(channel, "presence")
        channel.subscribe(blockUntilSubscribed = true)
        Log.i(TAG, "presence channel SUBSCRIBED")
        trackPresence(session)
        startPresenceRetrack(session)
    }

    private suspend fun subscribePlaylistBroadcast(playlistId: String) {
        val channel = supabase.channel("playlist-broadcast-$playlistId")
        playlistChannel = channel

        channel.broadcastFlow<PlaylistRefreshBroadcast>(event = "refresh")
            .onEach {
                Log.i(TAG, "Playlist refresh broadcast received")
                syncTrigger.onSyncRequested("playlist-broadcast")
            }
            .catch { e -> Log.e(TAG, "playlist-broadcast flow error", e) }
            .launchIn(scope)

        watchChannelStatus(channel, "playlist-broadcast")
        channel.subscribe(blockUntilSubscribed = true)
        Log.i(TAG, "playlist-broadcast channel SUBSCRIBED")
    }

    private fun watchChannelStatus(channel: RealtimeChannel, label: String) {
        scope.launch {
            channel.status
                .drop(1)
                .collect { status ->
                    if (status == RealtimeChannel.Status.UNSUBSCRIBED && currentSession != null) {
                        Log.w(TAG, "$label channel unsubscribed — scheduling reconnect")
                        scheduleReconnect()
                    }
                }
        }
    }

    private suspend fun updatePlaylistChannel(playlistId: String) {
        sessionMutex.withLock {
            val session = currentSession ?: return
            currentSession = session.copy(playlistId = playlistId)
        }
        playlistChannel?.let { supabase.realtime.removeChannel(it) }
        playlistChannel = null
        subscribePlaylistBroadcast(playlistId)
    }

    private suspend fun trackPresence(session: PlayerRealtimeSession) {
        val channel = presenceChannel ?: return
        channel.track(
            DevicePresencePayload(
                deviceId = session.deviceId,
                onlineAt = Instant.now().toString()
            )
        )
    }

    private fun startPresenceRetrack(session: PlayerRealtimeSession) {
        presenceRetrackJob?.cancel()
        presenceRetrackJob = scope.launch {
            while (isActive && currentSession != null) {
                delay(60_000)
                runCatching { trackPresence(session) }
                    .onFailure {
                        Log.w(TAG, "Presence re-track failed", it)
                        schedulePresenceReconnect()
                    }
            }
        }
    }

    private fun schedulePresenceReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(3_000)
            val session = currentSession ?: return@launch
            runCatching {
                presenceChannel?.let { supabase.realtime.removeChannel(it) }
                presenceChannel = null
                subscribePresence(session)
            }.onFailure { Log.e(TAG, "Presence reconnect failed", it) }
        }
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            reconnectAttempt++
            val backoffMs = minOf(30_000L, 3_000L * (1 shl (reconnectAttempt - 1).coerceAtMost(3)))
            delay(backoffMs)
            val session = currentSession ?: return@launch
            connectChannels(session)
        }
    }

    private fun getOrCreatePresenceKey(): String {
        val existing = presencePrefs.getString(PRESENCE_KEY, null)
        if (existing != null) return existing
        val newKey = UUID.randomUUID().toString()
        presencePrefs.edit().putString(PRESENCE_KEY, newKey).apply()
        return newKey
    }

    private suspend fun teardownChannels() {
        presenceRetrackJob?.cancel()
        presenceRetrackJob = null
        devicePairChannel?.let { supabase.realtime.removeChannel(it) }
        presenceChannel?.let { supabase.realtime.removeChannel(it) }
        playlistChannel?.let { supabase.realtime.removeChannel(it) }
        devicePairChannel = null
        presenceChannel = null
        playlistChannel = null
    }

    companion object {
        private const val TAG = "PlayerRealtimeManager"
        private const val PRESENCE_KEY = "nuexis_presence_key"
    }
}
