package com.nuexis.player

import android.app.Activity
import android.util.Base64
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.nuexis.player.data.StorageManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

object ScreenshotHelper {
    fun captureAndUpload(activity: Activity, storageManager: StorageManager, supabaseUrl: String, backendUrl: String?) {
        try {
            val rootView = activity.window.decorView.rootView
            val width = rootView.width
            val height = rootView.height
            if (width <= 0 || height <= 0) return

            val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            rootView.draw(canvas)

            val byteArrayOutputStream = java.io.ByteArrayOutputStream()
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 80, byteArrayOutputStream)
            val byteArray = byteArrayOutputStream.toByteArray()
            val base64Data = Base64.encodeToString(byteArray, Base64.DEFAULT)

            val deviceId = storageManager.getDeviceId() ?: return
            val hardwareId = storageManager.getHardwareId()
            val secret = storageManager.getSecret() ?: return

            val payload = JsonObject().apply {
                addProperty("deviceId", deviceId)
                addProperty("hardwareId", hardwareId)
                addProperty("secret", secret)
                addProperty("base64Data", base64Data)
            }

            val baseUrl = if (!backendUrl.isNullOrEmpty()) {
                backendUrl
            } else {
                supabaseUrl
            }
            val url = if (baseUrl.endsWith("/")) "${baseUrl}api/player/screenshot" else "$baseUrl/api/player/screenshot"

            val requestBody = Gson().toJson(payload).toRequestBody("application/json; charset=utf-8".toMediaType())
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()

            OkHttpClient().newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.e("ScreenshotHelper", "Screenshot upload failed: ${response.code} ${response.body?.string()}")
                } else {
                    Log.d("ScreenshotHelper", "Screenshot uploaded successfully")
                }
            }
        } catch (e: Exception) {
            Log.e("ScreenshotHelper", "Failed to capture or upload screenshot", e)
        }
    }
}
