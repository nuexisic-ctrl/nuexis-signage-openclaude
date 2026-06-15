package com.nuexis.player.data

import android.content.Context
import android.os.Environment
import android.provider.Settings
import android.util.Base64
import android.util.Log
import com.google.gson.Gson
import java.io.File
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

class IdentityBackupManager(private val context: Context) {

    private val gson = Gson()
    private val tag = "IdentityBackupManager"
    private val fileName = "nuexis_player_identity.enc"

    data class Identity(
        val deviceId: String,
        val secret: String,
        val pairingCode: String
    )

    private fun getAndroidId(): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        return if (!androidId.isNullOrEmpty()) androidId else "fallback_secure_id"
    }

    private fun getSecretKeySpec(): SecretKeySpec {
        val digest = MessageDigest.getInstance("SHA-256")
        val keyBytes = digest.digest(getAndroidId().toByteArray(Charsets.UTF_8))
        return SecretKeySpec(keyBytes, "AES")
    }

    private fun encrypt(data: String): String {
        val cipher = Cipher.getInstance("AES")
        cipher.init(Cipher.ENCRYPT_MODE, getSecretKeySpec())
        val encryptedBytes = cipher.doFinal(data.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(encryptedBytes, Base64.DEFAULT)
    }

    private fun decrypt(encryptedData: String): String {
        val cipher = Cipher.getInstance("AES")
        cipher.init(Cipher.DECRYPT_MODE, getSecretKeySpec())
        val decodedBytes = Base64.decode(encryptedData, Base64.DEFAULT)
        val decryptedBytes = cipher.doFinal(decodedBytes)
        return String(decryptedBytes, Charsets.UTF_8)
    }

    private fun getBackupFile(): File {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        return File(downloadsDir, fileName)
    }

    fun backup(deviceId: String, secret: String, pairingCode: String) {
        try {
            val identity = Identity(deviceId, secret, pairingCode)
            val jsonString = gson.toJson(identity)
            val encryptedData = encrypt(jsonString)
            val file = getBackupFile()

            // Ensure parent directory exists
            file.parentFile?.mkdirs()
            file.writeText(encryptedData, Charsets.UTF_8)
            Log.d(tag, "Successfully backed up identity to ${file.absolutePath}")
        } catch (e: Exception) {
            Log.e(tag, "Failed to backup identity: ${e.message}", e)
        }
    }

    fun restore(): Identity? {
        try {
            val file = getBackupFile()
            if (!file.exists()) {
                Log.d(tag, "No backup file found at ${file.absolutePath}")
                return null
            }

            val encryptedData = file.readText(Charsets.UTF_8).trim()
            if (encryptedData.isEmpty()) {
                return null
            }

            val decryptedJson = decrypt(encryptedData)
            val identity = gson.fromJson(decryptedJson, Identity::class.java)
            Log.d(tag, "Successfully restored identity from ${file.absolutePath}")
            return identity
        } catch (e: Exception) {
            Log.e(tag, "Failed to restore identity: ${e.message}", e)
            return null
        }
    }

    fun clearBackup() {
        try {
            val file = getBackupFile()
            if (file.exists()) {
                file.delete()
                Log.d(tag, "Successfully deleted backup file at ${file.absolutePath}")
            }
        } catch (e: Exception) {
            Log.e(tag, "Failed to clear backup: ${e.message}", e)
        }
    }
}
