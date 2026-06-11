package com.nuexis.player.app

// Cache-busting comment to trigger full KSP/Dagger reprocessing
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.nuexis.player.app.diagnostics.StructuredLogger
import com.nuexis.player.app.kiosk.KioskController
import com.nuexis.player.core.domain.repository.DeviceRepository
import com.nuexis.player.feature.pairing.ui.PairingFragment
import com.nuexis.player.feature.player.ui.PlayerFragment
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var deviceRepository: DeviceRepository
    @Inject lateinit var logger: StructuredLogger
    @Inject lateinit var kioskController: KioskController
    @Inject lateinit var syncWorkScheduler: com.nuexis.player.core.domain.sync.SyncWorkScheduler

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        )

        kioskController.applyManagedConfiguration(this)
        kioskController.enterImmersiveMode(this)
        syncWorkScheduler.schedulePeriodicWorkers()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                kioskController.enterImmersiveMode(this@MainActivity)
            }
        })

        observeDeviceState()
    }

    private fun observeDeviceState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                deviceRepository.observeLocalDeviceState().collectLatest { device ->
                    if (device?.teamId == null) {
                        showPairing()
                    } else {
                        syncWorkScheduler.syncOnce()
                        showPlayer()
                    }
                }
            }
        }
    }

    private fun showPairing() {
        val fragment = supportFragmentManager.findFragmentByTag(TAG_PAIRING)
        if (fragment == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, PairingFragment(), TAG_PAIRING)
                .commit()
        }
    }

    private fun showPlayer() {
        val fragment = supportFragmentManager.findFragmentByTag(TAG_PLAYER)
        if (fragment == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, PlayerFragment(), TAG_PLAYER)
                .commit()
        }
    }

    override fun onResume() {
        super.onResume()
        kioskController.enterImmersiveMode(this)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) kioskController.enterImmersiveMode(this)
    }

    companion object {
        private const val TAG_PAIRING = "pairing"
        private const val TAG_PLAYER = "player"
    }
}
