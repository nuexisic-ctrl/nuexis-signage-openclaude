package com.nuexis.player

import android.content.Context
import com.nuexis.player.data.StorageManager
import com.nuexis.player.data.SupabaseClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class PairingManager(
    private val context: Context,
    private val supabaseClient: SupabaseClient,
    private val storageManager: StorageManager,
    private val scope: CoroutineScope
) {
    private val permanentExpiry = 253402300799000L // 9999-12-31 23:59:59 UTC

    fun registerNewDevice(
        onSuccess: (deviceId: String, pairingCode: String, expiresAt: Long) -> Unit,
        onFailure: (Exception) -> Unit
    ) {
        scope.launch(Dispatchers.IO) {
            val hardwareId = storageManager.getHardwareId()
            val existingCode = storageManager.getPairingCode()
            val initialCode = existingCode ?: generateRandomPairingCode()
            val expiresAt = permanentExpiry

            try {
                val result = supabaseClient.registerDevice(hardwareId, initialCode, expiresAt)
                withContext(Dispatchers.Main) {
                    storageManager.setDeviceId(result.id)
                    storageManager.setSecret(result.secret)
                    storageManager.setPairingCode(result.pairing_code)
                    storageManager.setExpiresAt(expiresAt)
                    onSuccess(result.id, result.pairing_code, expiresAt)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    onFailure(e)
                }
            }
        }
    }

    fun refreshPairingCode(
        codeToKeep: String? = null,
        onSuccess: (deviceId: String, pairingCode: String, expiresAt: Long) -> Unit,
        onFailure: (Exception) -> Unit
    ) {
        scope.launch(Dispatchers.IO) {
            val deviceId = storageManager.getDeviceId()
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret()
            if (deviceId == null || secret == null) {
                withContext(Dispatchers.Main) {
                    onFailure(IllegalStateException("Device ID or secret is null"))
                }
                return@launch
            }
            val finalCode = codeToKeep ?: generateRandomPairingCode()
            val expiresAt = permanentExpiry

            try {
                val result = supabaseClient.refreshDeviceCode(deviceId, hardwareId, secret, finalCode, expiresAt)
                withContext(Dispatchers.Main) {
                    storageManager.setPairingCode(finalCode)
                    storageManager.setExpiresAt(expiresAt)
                    onSuccess(result.id, finalCode, expiresAt)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    onFailure(e)
                }
            }
        }
    }

    fun handleUnpair(
        onComplete: () -> Unit
    ) {
        scope.launch(Dispatchers.IO) {
            val deviceId = storageManager.getDeviceId()
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret()
            if (deviceId != null && secret != null) {
                try {
                    supabaseClient.unpairDevice(deviceId, hardwareId, secret)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            withContext(Dispatchers.Main) {
                storageManager.setSessionToken(null)
                storageManager.clearAll()
                onComplete()
            }
        }
    }

    fun generateRandomPairingCode(): String {
        val chars = ('A'..'Z') + ('0'..'9')
        return (1..6).map { chars.random() }.joinToString("")
    }
}
