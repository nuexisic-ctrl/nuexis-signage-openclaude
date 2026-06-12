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

        binding.composeOverlay.setContent {
            PlayerOverlay(
                viewModel = viewModel,
                onReloadPlayer = {
                    // Logic to hard reload the player if necessary.
                    viewModel.playCurrentItem()
                }
            )
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    handleUiState(state)
                }
            }
        }
    }

    private fun handleUiState(state: PlayerUiState) {
        // Reset feedback container by default
        binding.statusContainer.visibility = View.GONE
        binding.errorIcon.visibility = View.GONE
        binding.errorDetailText.visibility = View.GONE
        binding.progressBar.visibility = View.GONE
        
        when (state) {
            is PlayerUiState.PlayingVideo -> {
                binding.imageView.visibility = View.GONE
                binding.webView.visibility = View.GONE
                binding.playerViewActive.visibility = View.VISIBLE
                binding.playerViewActive.player = state.playbackManager.getActivePlayer()
                
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
                binding.playerViewActive.visibility = View.GONE
                binding.imageView.visibility = View.GONE
                binding.webView.visibility = View.GONE
                binding.statusContainer.visibility = View.VISIBLE
                binding.progressBar.visibility = View.VISIBLE
                binding.statusText.text = "Syncing content..."
            }
            is PlayerUiState.NoContent -> {
                binding.playerViewActive.visibility = View.GONE
                binding.imageView.visibility = View.GONE
                binding.webView.visibility = View.GONE
                binding.statusContainer.visibility = View.VISIBLE
                binding.statusText.text = "No content assigned to this screen."
            }
            is PlayerUiState.Error -> {
                binding.playerViewActive.visibility = View.GONE
                binding.imageView.visibility = View.GONE
                binding.webView.visibility = View.GONE
                binding.statusContainer.visibility = View.VISIBLE
                binding.errorIcon.visibility = View.VISIBLE
                binding.statusText.text = "Something went wrong"
                binding.errorDetailText.visibility = View.VISIBLE
                binding.errorDetailText.text = state.message
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
