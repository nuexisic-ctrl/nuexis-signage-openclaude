package com.nuexis.player.utils

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object SecureStorage {

    private const val PREFS_FILENAME = "secure_nuexis_prefs"
    private const val KEY_DEVICE_SECRET = "device_secret"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_TEAM_ID = "team_id"
    private const val KEY_SESSION_TOKEN = "session_token"
    private const val KEY_SESSION_EXPIRES_AT = "session_expires_at"
    private const val KEY_LAST_MANIFEST = "last_manifest_json"

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

    fun saveDeviceIdentity(context: Context, deviceId: String, teamId: String? = null) {
        getSharedPrefs(context).edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .apply {
                if (teamId != null) putString(KEY_TEAM_ID, teamId)
            }
            .apply()
    }

    fun getDeviceId(context: Context): String? = getSharedPrefs(context).getString(KEY_DEVICE_ID, null)

    fun getTeamId(context: Context): String? = getSharedPrefs(context).getString(KEY_TEAM_ID, null)

    fun saveSession(context: Context, token: String, expiresAt: String) {
        getSharedPrefs(context).edit()
            .putString(KEY_SESSION_TOKEN, token)
            .putString(KEY_SESSION_EXPIRES_AT, expiresAt)
            .apply()
    }

    fun getSessionToken(context: Context): String? = getSharedPrefs(context).getString(KEY_SESSION_TOKEN, null)

    fun saveLastManifest(context: Context, manifestJson: String) {
        getSharedPrefs(context).edit().putString(KEY_LAST_MANIFEST, manifestJson).apply()
    }

    fun getLastManifest(context: Context): String? = getSharedPrefs(context).getString(KEY_LAST_MANIFEST, null)

    fun clear(context: Context) {
        getSharedPrefs(context).edit().clear().apply()
    }
}
