package com.nuexis.player.app.web

import org.json.JSONObject

object NativeBootstrap {
    fun create(
        nonce: String,
        hardwareId: String,
        secret: String?,
        versionName: String
    ): String {
        val nonceValue = JSONObject.quote(nonce)
        val hardwareValue = JSONObject.quote(hardwareId)
        val secretValue = secret?.let(JSONObject::quote) ?: "null"
        val versionValue = JSONObject.quote(versionName)
        return """
            (() => {
              const host = window.${NativeBridge.HOST_NAME};
              if (!host) return;
              const nonce = $nonceValue;
              let nativeSecret = $secretValue;
              Object.defineProperty(window, 'Android', {
                configurable: false,
                enumerable: false,
                writable: false,
                value: Object.freeze({
                  isNuExisPlayer: true,
                  version: $versionValue,
                  getNativeHardwareId: () => $hardwareValue,
                  getNativeSecret: () => nativeSecret,
                  setNativeSecret: (secret) => {
                    nativeSecret = String(secret || '');
                    host.setNativeSecret(nativeSecret, nonce);
                  },
                  clearNativeSecret: () => {
                    nativeSecret = null;
                    host.clearNativeSecret(nonce);
                  },
                  showWebsiteOverlay: (id, url, x, y, width, height, viewportWidth, viewportHeight) =>
                    host.showWebsiteOverlay(
                      String(id), String(url), Number(x), Number(y), Number(width), Number(height),
                      Number(viewportWidth), Number(viewportHeight), nonce
                    ),
                  hideWebsiteOverlay: (id) => host.hideWebsiteOverlay(String(id), nonce),
                  hideAllWebsiteOverlays: () => host.hideAllWebsiteOverlays(nonce),
                  setOrientation: (degrees) => host.setOrientation(Number(degrees), nonce),
                  cacheAsset: (url, cacheKey, mimeType) =>
                    host.cacheAsset(String(url), String(cacheKey), String(mimeType || ''), nonce),
                  log: (level, event, fields) =>
                    host.log(String(level), String(event), JSON.stringify(fields || {}), nonce),
                  heartbeat: () => host.heartbeat(nonce),
                  getHealthSnapshot: () => host.getHealthSnapshot(nonce),
                  getRecentLogs: () => host.getRecentLogs(nonce),
                  reload: () => host.reloadPlayer(nonce)
                })
              });
              window.dispatchEvent(new CustomEvent('nuexis-native-ready'));
            })();
        """.trimIndent()
    }
}
