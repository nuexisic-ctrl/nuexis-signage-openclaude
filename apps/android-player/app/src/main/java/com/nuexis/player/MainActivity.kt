package com.nuexis.player

import android.app.Application
import android.content.pm.ActivityInfo
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.nuexis.player.data.local.PlayerDatabase
import com.nuexis.player.ui.MainViewModel
import com.nuexis.player.ui.UiState
import com.nuexis.player.ui.pairing.PairingScreen
import com.nuexis.player.ui.player.LivePlayerScreen
import com.nuexis.player.ui.theme.NuExisPlayerTheme

class MainActivity : ComponentActivity() {

    private lateinit var viewModel: MainViewModel
    private var isFullscreen by mutableStateOf(true)
    private var isSidebarOpen by mutableStateOf(false)

    // Gesture & Touch Tracking Variables
    private var startX = 0f
    private var startY = 0f
    private var downTime = 0L
    private var isSwipeTracking = false
    private val tapTimestamps = mutableListOf<Long>()
    
    // User interaction callback for controls overlay visibility
    var onUserInteractionCallback: (() -> Unit)? = null
    var onSingleTapCallback: (() -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Keep screen turned on at all times (Kiosk mode)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 2. Hide status/navigation bars (Immersive fullscreen)
        window.decorView.post {
            if (isFullscreen) {
                enableImmersiveMode()
            }
        }

        // 3. Initialize Database & ViewModel
        val app = application as PlayerApp
        val database = app.database
        
        val factory = MainViewModelFactory(app, database)
        viewModel = ViewModelProvider(this, factory)[MainViewModel::class.java]

        // 4. Set Content View
        setContent {
            NuExisPlayerTheme {
                val uiState by viewModel.uiState.collectAsState()

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF07111F)),
                    contentAlignment = Alignment.Center
                ) {
                    when (val state = uiState) {
                        is UiState.Loading -> {
                            LoadingView()
                        }
                        is UiState.Pairing -> {
                            // Enforce landscape for pairing code visibility
                            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                            
                            PairingScreen(
                                code = state.code,
                                remainingMs = state.remainingMs,
                                isRegistering = state.isRegistering
                            )
                        }
                        is UiState.Paired -> {
                            // Programmatically rotate device orientation based on CMS configuration
                            applyOrientation(state.config.orientation)

                            LivePlayerScreen(
                                config = state.config,
                                playlist = state.playlist,
                                viewModel = viewModel,
                                isFullscreen = isFullscreen,
                                onFullscreenToggle = { setFullscreenMode(it) },
                                isSidebarOpen = isSidebarOpen,
                                onSidebarToggle = { isSidebarOpen = it }
                            )
                        }
                        is UiState.Expired -> {
                            LoadingView() // Handled internally by automatic regeneration loop
                        }
                        is UiState.Error -> {
                            // Fallback rendering
                            LoadingView()
                        }
                    }
                }
            }
        }
    }

    override fun onUserInteraction() {
        super.onUserInteraction()
        onUserInteractionCallback?.invoke()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        when (ev.action) {
            MotionEvent.ACTION_DOWN -> {
                startX = ev.x
                startY = ev.y
                downTime = System.currentTimeMillis()
                // Only track swipe gestures starting near the left edge of the screen (within 100 pixels)
                isSwipeTracking = ev.x < 100f
                
                // Track rapid taps anywhere on the screen
                val now = System.currentTimeMillis()
                tapTimestamps.add(now)
                tapTimestamps.removeAll { now - it > 1500L } // Remove taps older than 1.5 seconds
                
                if (tapTimestamps.size >= 5) {
                    tapTimestamps.clear()
                    isSidebarOpen = true
                    Log.d("MainActivity", "Gesture: Rapid 5-tap detected. Opening Sidebar.")
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (isSwipeTracking) {
                    val dx = ev.x - startX
                    val dy = ev.y - startY
                    // If dragged to the right by more than 120 pixels and vertical drift is minimal
                    if (dx > 120f && Math.abs(dy) < 100f) {
                        isSwipeTracking = false
                        isSidebarOpen = true
                        Log.d("MainActivity", "Gesture: Left edge swipe detected. Opening Sidebar.")
                        
                        // Send ACTION_CANCEL to child views to prevent scrolling or clicks
                        val cancelEvent = MotionEvent.obtain(ev).apply { action = MotionEvent.ACTION_CANCEL }
                        super.dispatchTouchEvent(cancelEvent)
                        cancelEvent.recycle()
                        return true
                    }
                }
            }
            MotionEvent.ACTION_UP -> {
                isSwipeTracking = false
                val upTime = System.currentTimeMillis()
                val dx = ev.x - startX
                val dy = ev.y - startY
                val distanceSquared = dx * dx + dy * dy
                val isTap = (upTime - downTime < 300L) && (distanceSquared < 100f)
                if (isTap) {
                    onSingleTapCallback?.invoke()
                }
            }
            MotionEvent.ACTION_CANCEL -> {
                isSwipeTracking = false
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun setFullscreenMode(fullscreen: Boolean) {
        isFullscreen = fullscreen
        if (fullscreen) {
            enableImmersiveMode()
        } else {
            showSystemBars()
        }
    }

    private fun enableImmersiveMode() {
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to enable immersive mode, fallback to legacy/no-op", e)
            try {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
            } catch (ignored: Exception) {}
        }
    }

    private fun showSystemBars() {
        try {
            WindowCompat.setDecorFitsSystemWindows(window, true)
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.show(WindowInsetsCompat.Type.systemBars())
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to show system bars, fallback to legacy", e)
            try {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            } catch (ignored: Exception) {}
        }
    }

    private fun applyOrientation(orientation: Int) {
        val targetOrientation = when (orientation) {
            90 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            180 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
            270 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
            else -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        }
        
        if (requestedOrientation != targetOrientation) {
            requestedOrientation = targetOrientation
        }
    }

    @Composable
    private fun LoadingView() {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

class MainViewModelFactory(
    private val application: Application,
    private val database: PlayerDatabase
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MainViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return MainViewModel(application, database) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
