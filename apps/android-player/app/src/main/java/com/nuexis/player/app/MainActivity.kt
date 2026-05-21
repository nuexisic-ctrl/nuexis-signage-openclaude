package com.nuexis.player.app

import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.nuexis.player.core.domain.realtime.PlayerRealtimeSession
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.core.domain.sync.SyncWorkScheduler
import com.nuexis.player.core.network.realtime.PlayerRealtimeManager
import com.nuexis.player.feature.pairing.ui.PairingFragment
import com.nuexis.player.feature.pairing.ui.PairingListener
import com.nuexis.player.feature.player.ui.PlayerFragment
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity(), PairingListener {

    @Inject
    lateinit var deviceRepository: DeviceRepository

    @Inject
    lateinit var playerRealtimeManager: PlayerRealtimeManager

    @Inject
    lateinit var syncWorkScheduler: SyncWorkScheduler

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUI()

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                playerRealtimeManager.reconnectIfNeeded()
            }
        }

        if (savedInstanceState == null) {
            lifecycleScope.launch {
                val localDevice = deviceRepository.observeLocalDeviceState().first()
                val teamId = localDevice?.teamId
                if (teamId != null && deviceRepository.getSecret() != null) {
                    startPairedSession(localDevice.id, teamId, localDevice.playlistId)
                    supportFragmentManager.beginTransaction()
                        .replace(R.id.fragment_container, PlayerFragment())
                        .commit()

                    // Check for changes on the server in the background
                    launch {
                        runCatching {
                            val hardwareId = deviceRepository.getHardwareId()
                            val secret = deviceRepository.getSecret()
                            val fresh = deviceRepository.getDeviceState(hardwareId, secret)
                            if (fresh?.teamId == null) {
                                supportFragmentManager.beginTransaction()
                                    .replace(R.id.fragment_container, PairingFragment())
                                    .commit()
                            }
                        }
                    }
                } else {
                    supportFragmentManager.beginTransaction()
                        .replace(R.id.fragment_container, PairingFragment())
                        .commit()
                }
            }
        }
    }

    override fun onDevicePaired() {
        lifecycleScope.launch {
            val device = deviceRepository.observeLocalDeviceState().first()
                ?: return@launch
            val teamId = device.teamId ?: return@launch
            startPairedSession(device.id, teamId, device.playlistId)
        }

        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, PlayerFragment())
            .commit()
    }

    private fun startPairedSession(deviceId: String, teamId: String, playlistId: String?) {
        syncWorkScheduler.schedulePeriodicWorkers()
        playerRealtimeManager.start(
            PlayerRealtimeSession(
                deviceId = deviceId,
                teamId = teamId,
                playlistId = playlistId
            )
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    private fun hideSystemUI() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
    }
}
