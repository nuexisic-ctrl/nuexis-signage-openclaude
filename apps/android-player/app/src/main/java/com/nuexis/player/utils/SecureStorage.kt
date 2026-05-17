package com.nuexis.player.utils

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object SecureStorage {

    private const val PREFS_FILENAME = "secure_nuexis_prefs"
    private const val KEY_DEVICE_SECRET = "device_secret"

    private fun getSharedPrefs(context: Context): SharedPreferences {
        // Create or retrieve the MasterKey for encryption
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        // Initialize EncryptedSharedPreferences
        return EncryptedSharedPreferences.create(
            context,
            PREFS_FILENAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveDeviceSecret(context: Context, secret: String) {
        getSharedPrefs(context).edit().putString(KEY_DEVICE_SECRET, secret).apply()
    }

    fun getDeviceSecret(context: Context): String? {
        return getSharedPrefs(context).getString(KEY_DEVICE_SECRET, null)
    }

    fun clear(context: Context) {
        getSharedPrefs(context).edit().clear().apply()
    }
}
