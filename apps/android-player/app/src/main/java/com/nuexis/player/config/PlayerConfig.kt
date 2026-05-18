package com.nuexis.player.config

import com.nuexis.player.BuildConfig

object PlayerConfig {
    val supabaseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/')
    val supabasePublishableKey: String = BuildConfig.SUPABASE_PUBLISHABLE_KEY
    val playerApiBaseUrl: String = BuildConfig.PLAYER_API_BASE_URL.trimEnd('/')

    val isConfigured: Boolean
        get() = supabaseUrl.startsWith("https://") &&
            supabasePublishableKey.isNotBlank() &&
            playerApiBaseUrl.startsWith("https://")
}
