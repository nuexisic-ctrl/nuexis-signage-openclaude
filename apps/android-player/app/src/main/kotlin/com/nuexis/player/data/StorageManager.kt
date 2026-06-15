package com.nuexis.player.data

import android.content.Context
import android.provider.Settings
import java.util.UUID

class StorageManager(private val context: Context) {
    private val prefs = context.getSharedPreferences("nuexis_player_prefs", Context.MODE_PRIVATE)
    private val backupManager = IdentityBackupManager(context)

    fun getHardwareId(): String {
        val hardwareId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        if (!hardwareId.isNullOrEmpty()) {
            return hardwareId
        }
        
        // Fallback: generate and persist a UUID if ANDROID_ID is null or empty
        var fallbackId = prefs.getString("fallback_hardware_id", null)
        if (fallbackId == null) {
            fallbackId = UUID.randomUUID().toString()
            prefs.edit().putString("fallback_hardware_id", fallbackId).apply()
        }
        return fallbackId
    }

    fun backupIdentity() {
        val deviceId = getDeviceId()
        val secret = getSecret()
        val pairingCode = getPairingCode()
        if (deviceId != null && secret != null && pairingCode != null) {
            backupManager.backup(deviceId, secret, pairingCode)
        }
    }

    fun restoreIdentity(): Boolean {
        val identity = backupManager.restore()
        if (identity != null) {
            // Write directly to SharedPreferences to prevent multiple premature backups
            prefs.edit()
                .putString("nuexis_device_id", identity.deviceId)
                .putString("nuexis_device_secret", identity.secret)
                .putString("nuexis_pairing_code", identity.pairingCode)
                .apply()
            return true
        }
        return false
    }

    fun getSecret(): String? = prefs.getString("nuexis_device_secret", null)
    fun setSecret(secret: String?) {
        prefs.edit().putString("nuexis_device_secret", secret).apply()
        if (secret != null) backupIdentity()
    }

    fun getDeviceId(): String? = prefs.getString("nuexis_device_id", null)
    fun setDeviceId(id: String?) {
        prefs.edit().putString("nuexis_device_id", id).apply()
        if (id != null) backupIdentity()
    }

    fun getPairingCode(): String? = prefs.getString("nuexis_pairing_code", null)
    fun setPairingCode(code: String?) {
        prefs.edit().putString("nuexis_pairing_code", code).apply()
        if (code != null) backupIdentity()
    }

    fun getExpiresAt(): Long = prefs.getLong("nuexis_expires_at", 0L)
    fun setExpiresAt(expiresAt: Long) = prefs.edit().putLong("nuexis_expires_at", expiresAt).apply()

    fun getOrientation(): Int = prefs.getInt("nuexis_orientation", 0)
    fun setOrientation(orientation: Int) = prefs.edit().putInt("nuexis_orientation", orientation).apply()

    fun getScaleMode(): String = prefs.getString("nuexis_scale_mode", "Fit") ?: "Fit"
    fun setScaleMode(mode: String) = prefs.edit().putString("nuexis_scale_mode", mode).apply()

    fun isMuted(): Boolean = prefs.getBoolean("nuexis_player_muted", true)
    fun setMuted(muted: Boolean) = prefs.edit().putBoolean("nuexis_player_muted", muted).apply()

    fun getSessionToken(): String? = prefs.getString("nuexis_session_token", null)
    fun setSessionToken(token: String?) = prefs.edit().putString("nuexis_session_token", token).apply()

    fun getPresenceKey(): String {
        var key = prefs.getString("nuexis_presence_key", null)
        if (key == null) {
            key = UUID.randomUUID().toString()
            prefs.edit().putString("nuexis_presence_key", key).apply()
        }
        return key
    }

    fun getCachedManifest(): String? = prefs.getString("nuexis_cached_manifest", null)
    fun setCachedManifest(manifestJson: String?) = prefs.edit().putString("nuexis_cached_manifest", manifestJson).apply()

    fun getCachedContentType(): String? = prefs.getString("nuexis_cached_content_type", null)
    fun setCachedContentType(type: String?) = prefs.edit().putString("nuexis_cached_content_type", type).apply()

    fun getCachedAssetId(): String? = prefs.getString("nuexis_cached_asset_id", null)
    fun setCachedAssetId(id: String?) = prefs.edit().putString("nuexis_cached_asset_id", id).apply()

    fun getCachedPlaylistId(): String? = prefs.getString("nuexis_cached_playlist_id", null)
    fun setCachedPlaylistId(id: String?) = prefs.edit().putString("nuexis_cached_playlist_id", id).apply()

    fun getCachedAssetFilePath(): String? = prefs.getString("nuexis_cached_asset_file_path", null)
    fun setCachedAssetFilePath(path: String?) = prefs.edit().putString("nuexis_cached_asset_file_path", path).apply()

    fun getCachedAssetMimeType(): String? = prefs.getString("nuexis_cached_asset_mime_type", null)
    fun setCachedAssetMimeType(mimeType: String?) = prefs.edit().putString("nuexis_cached_asset_mime_type", mimeType).apply()


    fun clearAll() {
        // Clear everything except hardware id fallback if any
        val fallbackId = prefs.getString("fallback_hardware_id", null)
        prefs.edit().clear().apply()
        if (fallbackId != null) {
            prefs.edit().putString("fallback_hardware_id", fallbackId).apply()
        }
        backupManager.clearBackup()
    }
}
