package com.nuexis.player.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.nuexis.player.state.PlayerStateHolder

class NetworkMonitor(private val context: Context) {
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private var onReconnectListener: (() -> Unit)? = null

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            val wasOffline = !PlayerStateHolder.state.value.networkOnline
            updateNetworkState()
            if (wasOffline && PlayerStateHolder.state.value.networkOnline) {
                onReconnectListener?.invoke()
            }
        }

        override fun onLost(network: Network) {
            updateNetworkState()
        }

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
            val wasOffline = !PlayerStateHolder.state.value.networkOnline
            updateNetworkState()
            if (wasOffline && PlayerStateHolder.state.value.networkOnline) {
                onReconnectListener?.invoke()
            }
        }
    }

    fun setOnReconnectListener(listener: () -> Unit) {
        onReconnectListener = listener
    }

    fun startMonitoring() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
        updateNetworkState()
    }

    fun stopMonitoring() {
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (e: Exception) {
            // Ignore if already unregistered
        }
    }

    fun isCurrentlyOnline(): Boolean {
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
        return capabilities != null &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun updateNetworkState() {
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
        val isOnline = capabilities != null &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

        val transportType = when {
            capabilities == null -> "None"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WiFi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
            else -> "Other"
        }

        PlayerStateHolder.update {
            it.copy(
                networkOnline = isOnline,
                deviceNetworkType = transportType
            )
        }
    }
}
