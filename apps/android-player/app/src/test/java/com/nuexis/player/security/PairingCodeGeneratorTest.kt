package com.nuexis.player.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingCodeGeneratorTest {
    @Test
    fun generatesSixCharacterHumanSafeCodes() {
        val code = PairingCodeGenerator.generate()

        assertEquals(6, code.length)
        assertTrue(code.matches(Regex("^[A-Z2-9]{6}$")))
    }
}
