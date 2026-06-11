package com.nuexis.player.feature.player.ui

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.nuexis.player.core.media.PlaybackManager
import com.nuexis.player.feature.player.databinding.FragmentPlayerBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@AndroidEntryPoint
class PlayerFragment : Fragment() {

    private var _binding: FragmentPlayerBinding? = null
    private val binding get() = _binding!!

    private val viewModel: PlayerViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPlayerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.playerViewActive.useController = false
        binding.playerViewBackground.useController = false

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    handleUiState(state)
                }
            }
        }
        
        // Listen to ExoPlayer completion via PlaybackManager
        // In a real implementation, you'd observe PlaybackManager.playbackState from ViewModel
    }

    private fun handleUiState(state: PlayerUiState) {
        when (state) {
            is PlayerUiState.PlayingVideo -> {
                binding.imageView.visibility = View.GONE
                binding.playerViewActive.visibility = View.VISIBLE
                binding.playerViewActive.player = state.playbackManager.getActivePlayer()
                
                // Assuming we listen to playback state in VM and it calls advanceToNext() on completion
                viewLifecycleOwner.lifecycleScope.launch {
                    state.playbackManager.playbackState.collect { playbackState ->
                        if (playbackState is PlaybackManager.PlaybackState.ItemCompleted) {
                            viewModel.advanceToNext()
                        }
                    }
                }
            }
            is PlayerUiState.PlayingImage -> {
                binding.playerViewActive.visibility = View.GONE
                binding.webView.visibility = View.GONE
                binding.imageView.visibility = View.VISIBLE
                binding.imageView.setImageURI(Uri.parse(state.uri))
                
                // Hold image for duration, then advance
                viewLifecycleOwner.lifecycleScope.launch {
                    delay(state.durationSeconds * 1000L)
                    viewModel.advanceToNext()
                }
            }
            is PlayerUiState.PlayingWebsite -> {
                binding.playerViewActive.visibility = View.GONE
                binding.imageView.visibility = View.GONE
                binding.webView.visibility = View.VISIBLE
                
                binding.webView.settings.javaScriptEnabled = true
                binding.webView.settings.domStorageEnabled = true
                binding.webView.loadUrl(state.url)

                viewLifecycleOwner.lifecycleScope.launch {
                    delay(state.durationSeconds * 1000L)
                    viewModel.advanceToNext()
                }
            }
            is PlayerUiState.Loading -> {
                // Show loading spinner
            }
            is PlayerUiState.NoContent -> {
                // Show logo or placeholder
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
