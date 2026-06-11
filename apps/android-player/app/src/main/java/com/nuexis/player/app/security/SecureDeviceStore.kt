package com.nuexis.player.app.security

import android.content.Context
import android.provider.Settings
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecureDeviceStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val preferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    val hardwareId: String
        get() {
            preferences.getString(KEY_HARDWARE_ID, null)?.let { return it }
            val androidId = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID
            )?.takeUnless { it.isBlank() || it == INVALID_ANDROID_ID }
            val generated = androidId?.let { "android-$it" }
                ?: "android-${UUID.randomUUID()}"
            preferences.edit().putString(KEY_HARDWARE_ID, generated).commit()
            return generated
        }

    var deviceSecret: String?
        get() = preferences.getString(KEY_DEVICE_SECRET, null)
        set(value) {
            preferences.edit().apply {
                if (value.isNullOrBlank()) remove(KEY_DEVICE_SECRET)
                else putString(KEY_DEVICE_SECRET, value)
            }.commit()
        }

    companion object {
        private const val FILE_NAME = "nuexis_secure_device"
        private const val KEY_HARDWARE_ID = "hardware_id"
        private const val KEY_DEVICE_SECRET = "device_secret"
        private const val INVALID_ANDROID_ID = "9774d56d682e549c"
    }
}
