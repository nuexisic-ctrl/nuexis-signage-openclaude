package com.nuexis.player.app.cache

import java.io.FilterInputStream
import java.io.InputStream

class BoundedInputStream(
    input: InputStream,
    private var remaining: Long
) : FilterInputStream(input) {
    override fun read(): Int {
        if (remaining <= 0) return -1
        val value = super.read()
        if (value >= 0) remaining--
        return value
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (remaining <= 0) return -1
        val allowed = minOf(length.toLong(), remaining).toInt()
        val count = super.read(buffer, offset, allowed)
        if (count > 0) remaining -= count
        return count
    }
}
