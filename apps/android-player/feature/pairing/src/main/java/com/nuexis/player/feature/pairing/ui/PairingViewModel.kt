package com.nuexis.player.feature.pairing.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuexis.player.core.domain.model.Device
import com.nuexis.player.core.domain.repository.DeviceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

@HiltViewModel
class PairingViewModel @Inject constructor(
    private val deviceRepository: DeviceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PairingUiState>(PairingUiState.Loading)
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    private var pollJob: Job? = null
    private var deviceId: String? = null

    companion object {
        private const val PAIRING_DURATION_MS = 15 * 60 * 1000L
        private const val POLL_INTERVAL_MS = 3_000L
    }

    init {
        bootstrapPairing()
    }

    private fun bootstrapPairing() {
        viewModelScope.launch {
            try {
                val hardwareId = deviceRepository.getHardwareId()
                val secret = deviceRepository.getSecret()
                val remote = deviceRepository.getDeviceState(hardwareId, secret)

                if (remote?.teamId != null) {
                    _uiState.value = PairingUiState.Paired
                    return@launch
                }

                if (remote != null && secret != null) {
                    deviceId = remote.id
                    val expiresMs = parseExpiresAt(remote)
                    if (expiresMs > System.currentTimeMillis() && remote.pairingCode.isNotBlank()) {
                        showPairingCode(remote.pairingCode)
                        return@launch
                    }
                    refreshPairingCode(hardwareId, secret, remote.id)
                    return@launch
                }

                registerNewDevice(hardwareId)
            } catch (e: Exception) {
                _uiState.value = PairingUiState.Error("Failed to generate code: ${e.message}")
            }
        }
    }

    private suspend fun registerNewDevice(hardwareId: String) {
        val code = generateCode()
        val expiresAtMs = System.currentTimeMillis() + PAIRING_DURATION_MS
        val device = deviceRepository.registerDevice(hardwareId, code, expiresAtMs)
        deviceId = device.id
        showPairingCode(code)
    }

    private suspend fun refreshPairingCode(hardwareId: String, secret: String, existingDeviceId: String) {
        val code = generateCode()
        val expiresAtMs = System.currentTimeMillis() + PAIRING_DURATION_MS
        deviceRepository.refreshPairingCode(existingDeviceId, hardwareId, secret, code, expiresAtMs)
        deviceId = existingDeviceId
        showPairingCode(code)
    }

    private fun showPairingCode(code: String) {
        _uiState.value = PairingUiState.CodeGenerated(code)
        startClaimPolling()
    }

    private fun startClaimPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(POLL_INTERVAL_MS)
                try {
                    val hardwareId = deviceRepository.getHardwareId()
                    val secret = deviceRepository.getSecret() ?: continue
                    val state = deviceRepository.getDeviceState(hardwareId, secret)
                    if (state?.teamId != null) {
                        _uiState.value = PairingUiState.Paired
                        break
                    }
                } catch (_: Exception) {
                    // Keep polling on transient network errors
                }
            }
        }
    }

    private fun parseExpiresAt(remote: Device): Long {
        val raw = remote.expiresAt ?: return 0L
        return try {
            Instant.parse(raw).toEpochMilli()
        } catch (_: Exception) {
            0L
        }
    }

    private fun generateCode(): String {
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return (1..6).map { chars.random() }.joinToString("")
    }

    override fun onCleared() {
        pollJob?.cancel()
        super.onCleared()
    }
}

sealed class PairingUiState {
    object Loading : PairingUiState()
    data class CodeGenerated(val code: String) : PairingUiState()
    object Paired : PairingUiState()
    data class Error(val message: String) : PairingUiState()
}
