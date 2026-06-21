package com.nuexis.player.cache

import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

object IntegrityChecker {
    private const val TAG = "IntegrityChecker"

    fun validate(file: File, expectedSize: Long, expectedSha256: String): Boolean {
        if (!file.exists()) {
            Log.w(TAG, "Validation failed: File does not exist: ${file.absolutePath}")
            return false
        }
        if (file.length() != expectedSize) {
            Log.w(TAG, "Validation failed for ${file.name}: Size mismatch. Expected: $expectedSize, Got: ${file.length()}")
            return false
        }

        val calculatedSha256 = calculateSha256(file)
        if (calculatedSha256 == null) {
            Log.e(TAG, "Validation failed for ${file.name}: Could not calculate SHA-256")
            return false
        }

        val matches = calculatedSha256.equals(expectedSha256, ignoreCase = true)
        if (!matches) {
            Log.w(TAG, "Validation failed for ${file.name}: SHA-256 mismatch. Expected: $expectedSha256, Got: $calculatedSha256")
        }
        return matches
    }

    fun calculateSha256(file: File): String? {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { fis ->
                val buffer = ByteArray(8192)
                var bytesRead = fis.read(buffer)
                while (bytesRead != -1) {
                    digest.update(buffer, 0, bytesRead)
                    bytesRead = fis.read(buffer)
                }
            }
            val hashBytes = digest.digest()
            hashBytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating SHA-256 for ${file.name}", e)
            null
        }
    }
}
