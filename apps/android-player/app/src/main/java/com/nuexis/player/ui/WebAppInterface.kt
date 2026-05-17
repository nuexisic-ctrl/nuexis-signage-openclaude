package com.nuexis.player.ui

import android.content.Context
import android.webkit.JavascriptInterface
import com.nuexis.player.utils.HardwareIdHelper
import com.nuexis.player.utils.SecureStorage

class WebAppInterface(private val mContext: Context) {
    @JavascriptInterface
    fun getNativeHardwareId(): String {
        return HardwareIdHelper.getHardwareId(mContext)
    }

    @JavascriptInterface
    fun getNativeSecret(): String? {
        return SecureStorage.getDeviceSecret(mContext)
    }

    @JavascriptInterface
    fun setNativeSecret(secret: String) {
        SecureStorage.saveDeviceSecret(mContext, secret)
    }

    @JavascriptInterface
    fun clearNativeSecret() {
        SecureStorage.clear(mContext)
    }
}
