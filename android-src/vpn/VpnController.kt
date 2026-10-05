package com.nogoon.app

// ─── VpnController (REAL — Network Shield enabled) ───────────────────────────
//
// Owns everything in the app that touches android.net.VpnService, so
// AppBlockerModule.kt stays free of VPN references. The withAppBlocker plugin
// copies EITHER this file (enableVpn: true) OR android-src/vpn-stub/VpnController.kt
// (default). The stub has the same class/API but references no VpnService, so
// the compiled app contains no VPN code and the manifest has no VPN service.

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class VpnController(private val ctx: ReactApplicationContext) {

    companion object {
        private const val VPN_REQUEST_CODE = 7777
    }

    // Held while waiting for the VPN consent dialog result
    private var startPromise: Promise? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != VPN_REQUEST_CODE) return
            val promise = startPromise ?: return
            startPromise = null
            if (resultCode == Activity.RESULT_OK) {
                try {
                    // startService, not startForegroundService: NoGoonVpnService never calls
                    // startForeground(); on Android 8+ the system killed the app a few seconds
                    // after enabling. A VpnService doesn't need to be a foreground service.
                    ctx.startService(Intent(ctx, NoGoonVpnService::class.java))
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("VPN_START_ERROR", e.message ?: "Unknown error", e)
                }
            } else {
                promise.reject("VPN_PERMISSION_DENIED", "User denied VPN permission")
            }
        }
    }

    init {
        ctx.addActivityEventListener(activityEventListener)
    }

    fun start(promise: Promise) {
        try {
            val prepareIntent = android.net.VpnService.prepare(ctx)
            if (prepareIntent != null) {
                val activity = ctx.currentActivity
                if (activity == null) {
                    promise.reject("VPN_NO_ACTIVITY", "No foreground activity available")
                    return
                }
                startPromise = promise
                activity.startActivityForResult(prepareIntent, VPN_REQUEST_CODE)
                return
            }
            ctx.startService(Intent(ctx, NoGoonVpnService::class.java))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VPN_START_ERROR", e.message ?: "Unknown error", e)
        }
    }

    fun stop(promise: Promise) {
        try {
            val intent = Intent(ctx, NoGoonVpnService::class.java).apply {
                action = NoGoonVpnService.ACTION_STOP
            }
            ctx.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VPN_STOP_ERROR", e.message ?: "Unknown error", e)
        }
    }

    fun isActive(promise: Promise) {
        try {
            val prefs = ctx.getSharedPreferences(AppBlockerModule.PREFS_NAME, 0)
            if (!prefs.getBoolean("vpnRunning", false)) {
                promise.resolve(false)
                return
            }
            // Heartbeat guards against a stale flag if the service was SIGKILL'd.
            val age = System.currentTimeMillis() - prefs.getLong("vpnHeartbeat", 0L)
            if (age > 10_000L) {
                prefs.edit().putBoolean("vpnRunning", false).remove("vpnHeartbeat").apply()
                promise.resolve(false)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // VpnService.prepare() returns null when the one-time consent is already held.
    fun isPermissionGranted(promise: Promise) {
        try {
            promise.resolve(android.net.VpnService.prepare(ctx) == null)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
