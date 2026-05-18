package com.nuexis.player.playback

import com.nuexis.player.data.ManifestItem
import com.nuexis.player.data.PlayerManifest

object PlaylistResolver {
    fun playableItems(manifest: PlayerManifest): List<ManifestItem> {
        return manifest.playlist
            .filter { item ->
                val mimeType = item.asset?.mimeType
                item.type == "widget" ||
                    mimeType?.startsWith("image/") == true ||
                    mimeType?.startsWith("video/") == true ||
                    mimeType == "application/x-widget-youtube" ||
                    mimeType == "application/x-widget-remote-url"
            }
            .sortedBy { it.sortOrder }
    }
}
