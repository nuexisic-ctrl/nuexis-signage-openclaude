package com.nuexis.player.utils

import android.content.Context
import android.provider.Settings
import java.security.MessageDigest

object HardwareIdHelper {

    fun getHardwareId(context: Context): String {
        // Fallback for getting an immutable ID.
        // Settings.Secure.ANDROID_ID is stable per-device-per-install,
        // which works well for a digital signage app.
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "UNKNOWN_DEVICE"
        
        // Hash it to ensure standard format and avoid leaking the raw ANDROID_ID
        return hashString("NuexisHardwareV1:$androidId")
    }

    private fun hashString(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }
}
