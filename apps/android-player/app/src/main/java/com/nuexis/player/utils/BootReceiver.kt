package com.nuexis.player.utils

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.nuexis.player.ui.PlayerActivity
import com.nuexis.player.system.PlayerWorkScheduler

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            PlayerWorkScheduler.schedule(context)
            val i = Intent(context, PlayerActivity::class.java)
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
        }
    }
}
