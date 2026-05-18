package com.nuexis.player.security

import java.security.SecureRandom

object PairingCodeGenerator {
    private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private val random = SecureRandom()

    fun generate(length: Int = 6): String {
        return buildString(length) {
            repeat(length) {
                append(ALPHABET[random.nextInt(ALPHABET.length)])
            }
        }
    }
}
