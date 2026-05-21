package com.nuexis.player.core.network.di

import com.nuexis.player.core.network.BuildConfig

data class SupabaseConfig(
    val baseUrl: String,
    val anonKey: String
) {
    companion object {
        fun fromBuildConfig(): SupabaseConfig = SupabaseConfig(
            baseUrl = BuildConfig.SUPABASE_URL,
            anonKey = BuildConfig.SUPABASE_ANON_KEY
        )
    }
}
