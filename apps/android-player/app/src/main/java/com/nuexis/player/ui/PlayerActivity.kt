package com.nuexis.player.ui

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class PlayerActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Setup Kiosk Mode: Keep screen on and hide system navigation/status bars
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)

        webView = WebView(this)
        setContentView(webView)

        // Configure WebView for modern web apps
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true // Required for React state and Service Worker caching
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false // Allow videos to auto-play!
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        // Inject our native Android capabilities into the window object
        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        webView.webViewClient = object : WebViewClient() {
            // Note: Caching is handled automatically by the DOM Cache API in the Next.js app.
        }
        
        webView.webChromeClient = WebChromeClient()

        // Load NuExis Player Next.js frontend
        // For local development on emulator, use 10.0.2.2.
        // For production, change to: https://yourdomain.com/player
        val playerUrl = "http://10.0.2.2:3000/player"
        webView.loadUrl(playerUrl)
    }
}
