package com.nuexis.player.feature.pairing.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun PairingScreen(
    viewModel: PairingViewModel = hiltViewModel(),
    onPaired: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    val bgColor = Color(0xFF07111F)
    val brandNuColor = Color(0x59FFFFFF)
    val brandExisColor = Color(0xCC094CB2)
    val labelColor = Color(0x66FFFFFF)
    val codeBgColor = Color(0x1AFFFFFF)
    val howToPathBgColor = Color(0x1F094CB2)
    val howToPathTextColor = Color(0xE6094CB2)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        when (state) {
            is PairingUiState.Loading -> {
                CircularProgressIndicator(color = brandExisColor)
            }
            is PairingUiState.CodeGenerated -> {
                val code = (state as PairingUiState.CodeGenerated).code
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = buildAnnotatedString {
                            withStyle(style = SpanStyle(color = brandNuColor)) {
                                append("NU")
                            }
                            withStyle(style = SpanStyle(color = brandExisColor)) {
                                append("EXIS")
                            }
                        },
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )

                    Spacer(modifier = Modifier.height(56.dp))

                    Text(
                        text = "PAIRING CODE",
                        color = labelColor,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 2.sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Box(
                        modifier = Modifier
                            .background(codeBgColor, RoundedCornerShape(14.dp))
                            .padding(horizontal = 40.dp, vertical = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = code,
                            color = Color.White,
                            fontSize = 56.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 14.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(56.dp))

                    Text(
                        text = "Enter this code in your NuExis dashboard to pair this screen.",
                        color = Color(0x8CFFFFFF),
                        fontSize = 15.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 32.dp)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Box(
                        modifier = Modifier
                            .background(howToPathBgColor, RoundedCornerShape(100.dp))
                            .padding(horizontal = 20.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = "Dashboard → Screens → Add Screen",
                            color = howToPathTextColor,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
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

