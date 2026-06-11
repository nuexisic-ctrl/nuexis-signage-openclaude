package com.nuexis.player.app

import android.annotation.SuppressLint
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.nuexis.player.app.cache.NativeCacheWebViewClient
import com.nuexis.player.app.diagnostics.StructuredLogger
import com.nuexis.player.app.kiosk.KioskController
import com.nuexis.player.app.overlay.WebsiteOverlayController
import com.nuexis.player.app.security.SecureDeviceStore
import com.nuexis.player.app.web.NativeBridge
import com.nuexis.player.app.web.NativeBootstrap
import com.nuexis.player.app.work.PlayerWorkScheduler
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var secureDeviceStore: SecureDeviceStore
    @Inject lateinit var logger: StructuredLogger
    @Inject lateinit var kioskController: KioskController
    @Inject lateinit var workScheduler: PlayerWorkScheduler

    private lateinit var playerWebView: WebView
    private lateinit var overlayContainer: FrameLayout
    private lateinit var overlayController: WebsiteOverlayController
    private lateinit var bridge: NativeBridge
    private val bridgeNonce = UUID.randomUUID().toString()
    private var lastRenderRecoveryAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        )

        playerWebView = findViewById(R.id.player_webview)
        overlayContainer = findViewById(R.id.website_overlay_container)
        overlayController = WebsiteOverlayController(
            activity = this,
            container = overlayContainer,
            primaryWebView = playerWebView,
            logger = logger
        )
        bridge = NativeBridge(
            activity = this,
            nonce = bridgeNonce,
            deviceStore = secureDeviceStore,
            overlayController = overlayController,
            logger = logger,
            workScheduler = workScheduler,
            primaryWebView = playerWebView
        )

        configureWebView()
        kioskController.applyManagedConfiguration(this)
        kioskController.enterImmersiveMode(this)
        workScheduler.schedule()
        logger.info("activity_created", mapOf("playerUrl" to BuildConfig.PLAYER_URL))

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                logger.warn("back_blocked")
                kioskController.enterImmersiveMode(this@MainActivity)
            }
        })

        playerWebView.loadUrl(BuildConfig.PLAYER_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        playerWebView.setBackgroundColor(Color.BLACK)
        playerWebView.isFocusable = true
        playerWebView.isFocusableInTouchMode = true

        playerWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            loadsImagesAutomatically = true
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = "$userAgentString NuExisAndroidPlayer/${BuildConfig.VERSION_NAME}"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(playerWebView, false)
        }

        playerWebView.addJavascriptInterface(bridge, NativeBridge.HOST_NAME)
        installBootstrapAtDocumentStart()
        playerWebView.webViewClient = object : NativeCacheWebViewClient(
            context = this@MainActivity,
            playerUri = Uri.parse(BuildConfig.PLAYER_URL),
            logger = logger
        ) {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                bridge.markPageHealthy()
                logger.info("page_finished", mapOf("url" to url))
            }

            override fun onRenderProcessGone(
                view: WebView,
                detail: RenderProcessGoneDetail
            ): Boolean {
                logger.error(
                    "webview_renderer_gone",
                    mapOf("didCrash" to detail.didCrash().toString())
                )
                recoverFromRendererFailure()
                return true
            }
        }
        playerWebView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: android.webkit.ConsoleMessage): Boolean {
                logger.web(
                    level = message.messageLevel().name,
                    message = message.message(),
                    source = message.sourceId(),
                    line = message.lineNumber()
                )
                return true
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(
                object : ServiceWorkerClient() {
                    override fun shouldInterceptRequest(
                        request: WebResourceRequest
                    ): WebResourceResponse? = null
                }
            )
        }
    }

    private fun installBootstrapAtDocumentStart() {
        val origin = Uri.parse(BuildConfig.PLAYER_URL).let {
            "${it.scheme}://${it.authority}"
        }
        val script = NativeBootstrap.create(
            nonce = bridgeNonce,
            hardwareId = secureDeviceStore.hardwareId,
            secret = secureDeviceStore.deviceSecret,
            versionName = BuildConfig.VERSION_NAME
        )
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(playerWebView, script, setOf(origin))
        } else {
            playerWebView.post { playerWebView.evaluateJavascript(script, null) }
        }
    }

    private fun recoverFromRendererFailure() {
        val now = SystemClock.elapsedRealtime()
        if (now - lastRenderRecoveryAt < RENDER_RECOVERY_COOLDOWN_MS) {
            logger.error("webview_recovery_escalated")
            recreate()
            return
        }
        lastRenderRecoveryAt = now
        lifecycleScope.launch {
            overlayController.destroyAll()
            delay(750)
            recreate()
        }
    }

    override fun onResume() {
        super.onResume()
        kioskController.enterImmersiveMode(this)
        bridge.markActivityHealthy()
        playerWebView.onResume()
        playerWebView.resumeTimers()
    }

    override fun onPause() {
        bridge.markActivityHealthy()
        playerWebView.onPause()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) kioskController.enterImmersiveMode(this)
    }

    override fun onDestroy() {
        overlayController.destroyAll()
        playerWebView.apply {
            stopLoading()
            loadUrl("about:blank")
            clearHistory()
            removeJavascriptInterface(NativeBridge.HOST_NAME)
            removeAllViews()
            destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val RENDER_RECOVERY_COOLDOWN_MS = 30_000L
    }
}
