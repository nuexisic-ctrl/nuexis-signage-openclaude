package com.nuexis.player.feature.pairing.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun PairingScreen(
    viewModel: PairingViewModel = hiltViewModel(),
    onPaired: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        when (state) {
            is PairingUiState.Loading -> {
                CircularProgressIndicator(color = Color.White)
            }
            is PairingUiState.CodeGenerated -> {
                val code = (state as PairingUiState.CodeGenerated).code
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Enter this code on the NuExis Dashboard", color = Color.White, fontSize = 24.sp)
                    Text(code, color = Color.Yellow, fontSize = 64.sp, fontWeight = FontWeight.Bold)
                }
            }
            is PairingUiState.Paired -> {
                onPaired()
            }
            is PairingUiState.Error -> {
                Text((state as PairingUiState.Error).message, color = Color.Red, fontSize = 18.sp)
            }
        }
    }
}
