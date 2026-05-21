package com.nuexis.player.core.network.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.SupabaseClient
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SupabaseModule {

    @Provides
    @Singleton
    fun provideSupabaseClient(config: SupabaseConfig): SupabaseClient {
        val baseUrl = config.baseUrl.trimEnd('/')
        return createSupabaseClient(
            supabaseUrl = baseUrl,
            supabaseKey = config.anonKey
        ) {
            install(Postgrest)
            install(Realtime) {
                disconnectOnNoSubscriptions = false
            }
        }
    }
}
