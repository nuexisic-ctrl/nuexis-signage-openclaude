package com.nuexis.player.core.domain.sync

import com.nuexis.player.core.domain.model.DownloadStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

data class AssetDiagnostic(
    val id: String,
    val fileName: String,
    val filePath: String,
    val mimeType: String,
    val sizeBytes: Long,
    val status: DownloadStatus,
    val localUri: String?,
    val lastError: String? = null,
    val downloadDurationMs: Long = 0,
    val downloadSpeedKbps: Double = 0.0,
    val url: String? = null,
    val httpStatus: Int = 0,
    val retryCount: Int = 0
)

@Singleton
class AssetSyncDiagnosticsManager @Inject constructor() {
    private val _diagnostics = MutableStateFlow<Map<String, AssetDiagnostic>>(emptyMap())
    val diagnostics: StateFlow<Map<String, AssetDiagnostic>> = _diagnostics.asStateFlow()

    fun updateDiagnostic(assetId: String, update: (AssetDiagnostic?) -> AssetDiagnostic) {
        val current = _diagnostics.value
        val updated = current.toMutableMap()
        updated[assetId] = update(current[assetId])
        _diagnostics.value = updated
    }

    fun clear() {
        _diagnostics.value = emptyMap()
    }
}
