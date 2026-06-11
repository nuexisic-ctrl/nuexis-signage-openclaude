package com.nuexis.player.app.diagnostics

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONObject
import java.io.File
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StructuredLogger @Inject constructor(
    @ApplicationContext context: Context
) {
    private val directory = File(context.filesDir, "diagnostics").apply { mkdirs() }
    private val activeFile = File(directory, "player.jsonl")

    @Synchronized
    fun info(event: String, fields: Map<String, String> = emptyMap()) =
        write("INFO", event, fields)

    @Synchronized
    fun warn(event: String, fields: Map<String, String> = emptyMap()) =
        write("WARN", event, fields)

    @Synchronized
    fun error(event: String, fields: Map<String, String> = emptyMap()) =
        write("ERROR", event, fields)

    @Synchronized
    fun web(level: String, message: String, source: String, line: Int) =
        write(
            level,
            "web_console",
            mapOf("message" to message, "source" to source, "line" to line.toString())
        )

    @Synchronized
    fun crash(threadName: String, throwable: Throwable) =
        write(
            "FATAL",
            "uncaught_exception",
            mapOf(
                "thread" to threadName,
                "type" to throwable.javaClass.name,
                "message" to (throwable.message ?: ""),
                "stack" to Log.getStackTraceString(throwable).take(MAX_STACK_LENGTH)
            )
        )

    @Synchronized
    fun readTail(maxLines: Int = 100): String {
        if (!activeFile.exists()) return "[]"
        val lines = activeFile.readLines().takeLast(maxLines)
        return lines.joinToString(prefix = "[", postfix = "]", separator = ",")
    }

    private fun write(level: String, event: String, fields: Map<String, String>) {
        rotateIfNeeded()
        val payload = JSONObject()
            .put("timestamp", Instant.now().toString())
            .put("level", level)
            .put("event", event)
            .put("fields", JSONObject(fields))
        activeFile.appendText(payload.toString() + "\n")
        Log.println(logPriority(level), TAG, "$event $fields")
    }

    private fun rotateIfNeeded() {
        if (!activeFile.exists() || activeFile.length() < MAX_FILE_BYTES) return
        val previous = File(directory, "player.previous.jsonl")
        if (previous.exists()) previous.delete()
        activeFile.renameTo(previous)
    }

    private fun logPriority(level: String): Int = when (level) {
        "FATAL", "ERROR" -> Log.ERROR
        "WARN", "WARNING" -> Log.WARN
        "DEBUG" -> Log.DEBUG
        else -> Log.INFO
    }

    companion object {
        private const val TAG = "NuExisPlayer"
        private const val MAX_FILE_BYTES = 2L * 1024 * 1024
        private const val MAX_STACK_LENGTH = 16_000
    }
}
