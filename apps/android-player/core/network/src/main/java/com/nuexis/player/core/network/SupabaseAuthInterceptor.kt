package com.nuexis.player.core.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * Adds Supabase REST headers on every request (apikey + Authorization bearer anon JWT).
 */
class SupabaseAuthInterceptor(
    private val anonKey: String
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .header("apikey", anonKey)
            .header("Authorization", "Bearer $anonKey")
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .build()
        return chain.proceed(request)
    }
}
