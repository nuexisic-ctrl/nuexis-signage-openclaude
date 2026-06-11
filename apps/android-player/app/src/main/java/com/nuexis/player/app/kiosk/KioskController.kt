package com.nuexis.player.app.kiosk

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.UserManager
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KioskController @Inject constructor() {

    fun applyManagedConfiguration(activity: Activity) {
        val policyManager = activity.getSystemService(DevicePolicyManager::class.java)
        if (!policyManager.isDeviceOwnerApp(activity.packageName)) return

        val admin = ComponentName(activity, NuExisDeviceAdminReceiver::class.java)
        policyManager.setLockTaskPackages(admin, arrayOf(activity.packageName))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            policyManager.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
        }
        runCatching { policyManager.setStatusBarDisabled(admin, true) }
        runCatching { policyManager.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT) }
        runCatching { policyManager.addUserRestriction(admin, UserManager.DISALLOW_ADD_USER) }
        runCatching { policyManager.addUserRestriction(admin, UserManager.DISALLOW_CREATE_WINDOWS) }

        val activityManager = activity.getSystemService(ActivityManager::class.java)
        if (activityManager.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
            activity.startLockTask()
        }
    }

    fun enterImmersiveMode(activity: Activity) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.window.setDecorFitsSystemWindows(false)
            activity.window.insetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            activity.window.decorView.systemUiVisibility = (
                android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                )
        }
    }
}
