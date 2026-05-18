package com.nuexis.player.playback

import com.nuexis.player.data.ManifestAsset
import com.nuexis.player.data.ManifestItem
import com.nuexis.player.data.PlayerManifest
import org.junit.Assert.assertEquals
import org.junit.Test

class PlaylistResolverTest {
    @Test
    fun keepsPlayableItemsInSortOrderAndIgnoresUnsupportedSchedulePlaceholders() {
        val manifest = PlayerManifest(
            manifestVersion = "v1",
            deviceId = "device",
            teamId = "team",
            playlist = listOf(
                item("b", "image/png", 2),
                item("ignored", "application/pdf", 1),
                item("a", "video/mp4", 0)
            )
        )

        val result = PlaylistResolver.playableItems(manifest)

        assertEquals(listOf("a", "b"), result.map { it.id })
    }

    private fun item(id: String, mimeType: String, sortOrder: Int): ManifestItem {
        return ManifestItem(
            id = id,
            type = "asset",
            sortOrder = sortOrder,
            asset = ManifestAsset(
                id = id,
                filePath = "team/$id",
                mimeType = mimeType,
                sizeBytes = 1
            )
        )
    }
}
