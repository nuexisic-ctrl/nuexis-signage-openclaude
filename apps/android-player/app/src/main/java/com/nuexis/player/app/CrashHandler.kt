package com.nuexis.player.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Process
import android.os.SystemClock
import android.util.Log
import com.nuexis.player.app.diagnostics.StructuredLogger
import kotlin.system.exitProcess

class CrashHandler(
    private val context: Context,
    private val logger: StructuredLogger
) : Thread.UncaughtExceptionHandler {
    private val previousHandler = Thread.getDefaultUncaughtExceptionHandler()

    override fun uncaughtException(thread: Thread, exception: Throwable) {
        runCatching {
            logger.crash(thread.name, exception)
            scheduleRestart()
        }.onFailure {
            Log.e(TAG, "Failed to persist crash or schedule restart", it)
        }

        previousHandler?.uncaughtException(thread, exception)
            ?: run {
                Process.killProcess(Process.myPid())
                exitProcess(10)
            }
    }

    private fun scheduleRestart() {
        val restartIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            RESTART_REQUEST_CODE,
            restartIntent,
            PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        alarmManager.set(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + RESTART_DELAY_MS,
            pendingIntent
        )
    }

    companion object {
        private const val TAG = "NuExisCrashHandler"
        private const val RESTART_REQUEST_CODE = 9401
        private const val RESTART_DELAY_MS = 2_000L
    }
}
