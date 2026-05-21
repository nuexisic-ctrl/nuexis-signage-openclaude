package com.nuexis.player.app

import android.content.Context
import android.content.Intent
import android.util.Log
import kotlin.system.exitProcess

class CrashHandler(private val context: Context) : Thread.UncaughtExceptionHandler {
    private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

    override fun uncaughtException(thread: Thread, exception: Throwable) {
        Log.e("CrashHandler", "Uncaught exception detected: ${exception.message}", exception)
        
        // Watchdog: Restart the app automatically on crash
        val intent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        context.startActivity(intent)
        
        // Terminate the current process gracefully
        exitProcess(1)
    }
}
