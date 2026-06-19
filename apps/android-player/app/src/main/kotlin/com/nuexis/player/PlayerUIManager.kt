package com.nuexis.player

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout
import androidx.lifecycle.lifecycleScope
import android.os.Handler
import android.os.Looper
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class PlayerUIManager(
    private val activity: MainActivity,
    private val drawerLayout: DrawerLayout,
    private val mainContentContainer: FrameLayout
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var controlOverlayHideRunnable: Runnable? = null
    var isImmersive = false
    var currentView: View? = null

    fun showLoading() {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(activity).inflate(R.layout.view_loading, mainContentContainer, false)
        mainContentContainer.addView(currentView)
    }

    fun showPairing(code: String) {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(activity).inflate(R.layout.view_pairing, mainContentContainer, false)
        currentView?.findViewById<TextView>(R.id.tv_pairing_code)?.text = code
        mainContentContainer.addView(currentView)
    }

    fun showExpired(onRegenerate: () -> Unit) {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(activity).inflate(R.layout.view_expired, mainContentContainer, false)
        currentView?.findViewById<Button>(R.id.btn_regenerate)?.setOnClickListener {
            onRegenerate()
        }
        mainContentContainer.addView(currentView)
    }

    fun showConnectionError(message: String, onRetry: () -> Unit) {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(activity).inflate(R.layout.view_connection_error, mainContentContainer, false)
        currentView?.findViewById<TextView>(R.id.tv_error_message)?.text = message
        currentView?.findViewById<Button>(R.id.btn_retry)?.setOnClickListener {
            onRetry()
        }
        mainContentContainer.addView(currentView)
    }

    fun showPaired(onMenuClick: () -> Unit, onFullscreenClick: () -> Unit) {
        mainContentContainer.removeAllViews()
        currentView = LayoutInflater.from(activity).inflate(R.layout.view_paired, mainContentContainer, false)
        
        currentView?.findViewById<View>(R.id.btn_menu)?.setOnClickListener {
            onMenuClick()
        }

        currentView?.findViewById<android.widget.ImageButton>(R.id.btn_fullscreen)?.setOnClickListener {
            onFullscreenClick()
        }

        updateFullscreenButton()
        applyImmersiveMode(isImmersive)

        mainContentContainer.addView(currentView)
        showControlOverlayTemporarily()
    }

    fun updateFullscreenButton() {
        val btnFullscreen = currentView?.findViewById<android.widget.ImageButton>(R.id.btn_fullscreen)
        btnFullscreen?.setImageResource(
            if (isImmersive) R.drawable.ic_fullscreen_exit else R.drawable.ic_fullscreen
        )
    }

    fun toggleImmersiveMode() {
        isImmersive = !isImmersive
        applyImmersiveMode(isImmersive)
        updateFullscreenButton()
    }

    fun showControlOverlayTemporarily() {
        val overlay = currentView?.findViewById<View>(R.id.control_overlay) ?: return
        
        controlOverlayHideRunnable?.let { mainHandler.removeCallbacks(it) }
        
        if (overlay.visibility != View.VISIBLE) {
            overlay.alpha = 0f
            overlay.visibility = View.VISIBLE
            overlay.animate().alpha(1f).setDuration(250).start()
        }
        
        if (drawerLayout.isDrawerOpen(GravityCompat.START)) {
            return
        }
        
        val hideRunnable = Runnable {
            overlay.animate().alpha(0f).setDuration(250).withEndAction {
                overlay.visibility = View.GONE
            }.start()
        }
        controlOverlayHideRunnable = hideRunnable
        mainHandler.postDelayed(hideRunnable, 3000)
    }

    fun applyImmersiveMode(enable: Boolean) {
        if (enable) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                activity.window.setDecorFitsSystemWindows(false)
                activity.window.insetsController?.hide(
                    android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars()
                )
                activity.window.insetsController?.systemBarsBehavior =
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                @Suppress("DEPRECATION")
                activity.window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                )
            }
        } else {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                activity.window.setDecorFitsSystemWindows(true)
                activity.window.insetsController?.show(
                    android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars()
                )
            } else {
                @Suppress("DEPRECATION")
                activity.window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                )
            }
        }
    }

    fun checkAndRequestStoragePermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            if (!android.os.Environment.isExternalStorageManager()) {
                try {
                    AlertDialog.Builder(activity)
                        .setTitle("Storage Permission Required")
                        .setMessage("This app needs 'All files access' permission to securely persist the device identity across uninstalls/reinstalls. Please enable it in the next screen.")
                        .setPositiveButton("Allow") { _, _ ->
                            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                                data = Uri.fromParts("package", activity.packageName, null)
                            }
                            activity.startActivity(intent)
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                        activity.startActivity(intent)
                    } catch (ex: Exception) {
                        ex.printStackTrace()
                    }
                }
            }
        } else {
            val permissions = arrayOf(
                android.Manifest.permission.READ_EXTERNAL_STORAGE,
                android.Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
            val neededPermissions = permissions.filter {
                ContextCompat.checkSelfPermission(activity, it) != android.content.pm.PackageManager.PERMISSION_GRANTED
            }
            if (neededPermissions.isNotEmpty()) {
                ActivityCompat.requestPermissions(activity, neededPermissions.toTypedArray(), 1001)
            }
        }
    }

    fun setupSidebar() {
        val btnRefresh = activity.findViewById<MaterialButton>(R.id.btn_refresh)
        val btnUnpair = activity.findViewById<MaterialButton>(R.id.btn_unpair)
        val btnMute = activity.findViewById<MaterialButton>(R.id.btn_mute)
        val btnOrientation = activity.findViewById<MaterialButton>(R.id.btn_orientation)
        val btnCloseDrawer = activity.findViewById<View>(R.id.btn_close_drawer)

        btnCloseDrawer?.setOnClickListener {
            drawerLayout.closeDrawer(GravityCompat.START)
        }

        btnRefresh?.setOnClickListener {
            drawerLayout.closeDrawer(GravityCompat.START)
            activity.contentSyncManager.syncSignageContent(forceReload = true)
        }

        btnUnpair?.setOnClickListener {
            drawerLayout.closeDrawer(GravityCompat.START)
            AlertDialog.Builder(activity)
                .setTitle("Unpair Screen")
                .setMessage("Are you sure you want to unpair this screen?")
                .setPositiveButton("Yes") { _, _ -> activity.handleUnpair() }
                .setNegativeButton("No", null)
                .show()
        }

        btnMute?.setOnClickListener {
            val nextMute = !activity.storageManager.isMuted()
            activity.storageManager.setMuted(nextMute)
            activity.contentSyncManager.setMuted(nextMute)
            btnMute.text = if (nextMute) "Unmute" else "Mute"
            btnMute.setIconResource(if (nextMute) R.drawable.ic_volume_off else R.drawable.ic_volume)
            drawerLayout.closeDrawer(GravityCompat.START)
        }
        btnMute?.text = if (activity.storageManager.isMuted()) "Unmute" else "Mute"
        btnMute?.setIconResource(if (activity.storageManager.isMuted()) R.drawable.ic_volume_off else R.drawable.ic_volume)

        btnOrientation?.setOnClickListener {
            showOrientationSelector()
        }
        updateOrientationButtonText()
    }

    fun updateOrientationButtonText() {
        val btnOrientation = activity.findViewById<Button>(R.id.btn_orientation)
        btnOrientation?.text = when (activity.storageManager.getOrientation()) {
            0 -> "0° — Landscape"
            90 -> "90° — Portrait CW"
            180 -> "180° — Landscape Flipped"
            270 -> "270° — Portrait CCW"
            else -> "0° — Landscape"
        }
    }

    private fun showOrientationSelector() {
        val items = arrayOf(
            "0° — Landscape",
            "90° — Portrait CW",
            "180° — Landscape Flipped",
            "270° — Portrait CCW"
        )
        AlertDialog.Builder(activity)
            .setTitle("Select Screen Orientation")
            .setItems(items) { _, which ->
                val degrees = when (which) {
                    0 -> 0
                    1 -> 90
                    2 -> 180
                    3 -> 270
                    else -> 0
                }
                activity.lifecycleScope.launch(Dispatchers.IO) {
                    val deviceId = activity.storageManager.getDeviceId()
                    val hardwareId = activity.storageManager.getHardwareId()
                    val secret = activity.storageManager.getSecret()
                    if (deviceId != null && secret != null) {
                        try {
                            activity.supabaseClient.updateDeviceOrientation(deviceId, hardwareId, secret, degrees)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    withContext(Dispatchers.Main) {
                        activity.storageManager.setOrientation(degrees)
                        activity.applyNativeOrientation(degrees)
                        updateOrientationButtonText()
                        drawerLayout.closeDrawer(GravityCompat.START)
                    }
                }
            }
            .show()
    }
}
