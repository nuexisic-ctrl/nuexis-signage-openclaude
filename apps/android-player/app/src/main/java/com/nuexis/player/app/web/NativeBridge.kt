package com.nuexis.player.app.web

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.ActivityInfo
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.StatFs
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import com.nuexis.player.app.BuildConfig
import com.nuexis.player.app.MainActivity
import com.nuexis.player.app.diagnostics.StructuredLogger
import com.nuexis.player.app.overlay.WebsiteOverlayController
import com.nuexis.player.app.security.SecureDeviceStore
import com.nuexis.player.app.work.PlayerWorkScheduler
import com.nuexis.player.app.work.WatchdogWorker
import org.json.JSONObject

class NativeBridge(
    private val activity: MainActivity,
    private val nonce: String,
    private val deviceStore: SecureDeviceStore,
    private val overlayController: WebsiteOverlayController,
    private val logger: StructuredLogger,
    private val workScheduler: PlayerWorkScheduler,
    private val primaryWebView: WebView
) {
    private val healthPreferences = activity.getSharedPreferences(
        WatchdogWorker.HEALTH_PREFERENCES,
        Context.MODE_PRIVATE
    )

    @JavascriptInterface
    fun setNativeSecret(secret: String, providedNonce: String) {
        if (!authorized(providedNonce)) return
        deviceStore.deviceSecret = secret.take(MAX_SECRET_LENGTH)
        logger.info("device_secret_saved")
    }

    @JavascriptInterface
    fun clearNativeSecret(providedNonce: String) {
        if (!authorized(providedNonce)) return
        deviceStore.deviceSecret = null
        logger.info("device_secret_cleared")
    }

    @JavascriptInterface
    fun showWebsiteOverlay(
        id: String,
        url: String,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        viewportWidth: Double,
        viewportHeight: Double,
        providedNonce: String
    ) {
        if (!authorized(providedNonce)) return
        overlayController.show(
            id.take(MAX_ID_LENGTH),
            url.take(MAX_URL_LENGTH),
            x,
            y,
            width,
            height,
            viewportWidth,
            viewportHeight
        )
    }

    @JavascriptInterface
    fun hideWebsiteOverlay(id: String, providedNonce: String) {
        if (!authorized(providedNonce)) return
        overlayController.hide(id.take(MAX_ID_LENGTH))
    }

    @JavascriptInterface
    fun hideAllWebsiteOverlays(providedNonce: String) {
        if (!authorized(providedNonce)) return
        overlayController.destroyAll()
    }

    @JavascriptInterface
    fun setOrientation(degrees: Double, providedNonce: String) {
        if (!authorized(providedNonce)) return
        val normalized = degrees.toInt()
        val orientation = when (normalized) {
            0 -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            90 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            180 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
            270 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
            else -> return
        }
        activity.runOnUiThread {
            if (activity.requestedOrientation != orientation) {
                activity.requestedOrientation = orientation
                logger.info("orientation_applied", mapOf("degrees" to normalized.toString()))
            }
        }
    }

    @JavascriptInterface
    fun cacheAsset(
        url: String,
        cacheKey: String,
        mimeType: String,
        providedNonce: String
    ) {
        if (!authorized(providedNonce)) return
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return
        if (uri.scheme != "https" || uri.host.isNullOrBlank()) return
        if (cacheKey.isBlank() || cacheKey.length > MAX_CACHE_KEY_LENGTH) return
        workScheduler.cacheAsset(
            url = url.take(MAX_URL_LENGTH),
            cacheKey = cacheKey,
            mimeType = mimeType.take(MAX_MIME_LENGTH)
        )
    }

    @JavascriptInterface
    fun log(level: String, event: String, fieldsJson: String, providedNonce: String) {
        if (!authorized(providedNonce)) return
        val fields = runCatching {
            val json = JSONObject(fieldsJson.take(MAX_FIELDS_LENGTH))
            json.keys().asSequence().take(MAX_FIELD_COUNT).associateWith {
                json.optString(it).take(MAX_FIELD_VALUE_LENGTH)
            }
        }.getOrDefault(emptyMap())
        when (level.uppercase()) {
            "ERROR", "FATAL" -> logger.error(event.take(MAX_EVENT_LENGTH), fields)
            "WARN", "WARNING" -> logger.warn(event.take(MAX_EVENT_LENGTH), fields)
            else -> logger.info(event.take(MAX_EVENT_LENGTH), fields)
        }
    }

    @JavascriptInterface
    fun heartbeat(providedNonce: String) {
        if (!authorized(providedNonce)) return
        markPageHealthy()
    }

    @JavascriptInterface
    fun getHealthSnapshot(providedNonce: String): String {
        if (!authorized(providedNonce)) return "{}"
        val stat = StatFs(activity.filesDir.absolutePath)
        val activityManager = activity.getSystemService(ActivityManager::class.java)
        val connectivity = activity.getSystemService(ConnectivityManager::class.java)
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
        val networkType = when {
            capabilities == null -> "offline"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            else -> "other"
        }
        val devicePolicyManager = activity.getSystemService(DevicePolicyManager::class.java)
        return JSONObject()
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("osVersion", Build.VERSION.RELEASE)
            .put("sdk", Build.VERSION.SDK_INT)
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("memoryClassMb", activityManager.memoryClass)
            .put("freeDiskBytes", stat.availableBytes)
            .put("networkType", networkType)
            .put("deviceOwner", devicePolicyManager.isDeviceOwnerApp(activity.packageName))
            .put("webViewVersion", WebViewCompat.getCurrentWebViewPackage(activity)?.versionName)
            .put("currentUrl", primaryWebView.url)
            .put("timestamp", System.currentTimeMillis())
            .toString()
    }

    @JavascriptInterface
    fun getRecentLogs(providedNonce: String): String =
        if (authorized(providedNonce)) logger.readTail() else "[]"

    @JavascriptInterface
    fun reloadPlayer(providedNonce: String) {
        if (!authorized(providedNonce)) return
        activity.runOnUiThread {
            overlayController.destroyAll()
            primaryWebView.loadUrl(BuildConfig.PLAYER_URL)
        }
    }

    fun markPageHealthy() {
        healthPreferences.edit()
            .putLong(WatchdogWorker.KEY_LAST_HEALTHY_AT, System.currentTimeMillis())
            .apply()
    }

    fun markActivityHealthy() = markPageHealthy()

    private fun authorized(providedNonce: String): Boolean {
        val valid = providedNonce == nonce
        if (!valid) logger.warn("bridge_authorization_failed")
        return valid
    }

    companion object {
        const val HOST_NAME = "NuExisNativeHost"
        private const val MAX_SECRET_LENGTH = 512
        private const val MAX_ID_LENGTH = 128
        private const val MAX_URL_LENGTH = 8_192
        private const val MAX_CACHE_KEY_LENGTH = 1_024
        private const val MAX_MIME_LENGTH = 128
        private const val MAX_EVENT_LENGTH = 128
        private const val MAX_FIELDS_LENGTH = 8_192
        private const val MAX_FIELD_COUNT = 20
        private const val MAX_FIELD_VALUE_LENGTH = 1_024
    }
}
