// ─── AppBlocker Native Module ─────────────────────────────────────────────────
//
// Bridge between React Native JavaScript and Android system features.
// Exposes native methods to JS:
//   setBlockedApps(packages)                  — updates the app blocklist in SharedPreferences
//   setBlockedDomains(domains)                — updates the website blocklist in SharedPreferences
//   isServiceEnabled()                        — checks if Accessibility permission is granted
//   openAccessibilitySettings()               — opens Android's Accessibility Settings screen
//   isBatteryOptimized()                      — returns true if battery optimization is still on (bad)
//   openBatteryOptimizationSettings()         — opens the battery exemption dialog
//   openOemAutostartSettings()                — opens the OEM-specific autostart/battery manager screen
//   setTemporaryUnlock(domain, expiry)        — unlocks a domain until the given timestamp
//   clearTemporaryUnlock(domain)              — removes a temporary unlock
//   isBlockingPaused()                        — returns QS-tile pausedUntil timestamp (0 = not paused)
//   setBlockingPaused(paused)                 — set/clear a 30-min pause from JS
//   setFocusSessionEnd(endMs)                 — writes focus session expiry so Kotlin can enforce it
//   setGrayscaleEnabled(enabled)              — saves the dim-overlay preference
//   isGrayscaleEnabled()                      — reads the dim-overlay preference
//   openGrayscaleSettings()                   — shortcut to Android Accessibility → Color Correction
//   startVpn()                                — launches NoGoonVpnService (DNS-only blocker)
//   stopVpn()                                 — stops NoGoonVpnService
//   isVpnActive()                             — returns true if VPN service is running
//   setNotificationFilterEnabled(enabled)     — enables/disables notification suppression
//   isNotificationListenerEnabled()           — returns true if Notification Access is granted
//   openNotificationListenerSettings()        — opens Notification Access settings
//   getVpnDomainLog()                         — returns JSON array of recent blocked domains

package com.nogoon.app

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class AppBlockerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME               = "AppBlocker"
        // Must match NoGoonAccessibilityService.kt exactly
        const val PREFS_NAME         = "NoGoonBlocker"
        const val KEY_BLOCKLIST      = "blockedPackages"   // app package names
        const val KEY_DOMAIN_BLOCKLIST = "blockedDomains" // website domains
        const val KEY_ENABLED        = "serviceActive"

        private const val TAG = "NoGoon"
        private const val CRASH_NOTIFICATION_ID      = 9900
        private const val CRASH_NOTIFICATION_CHANNEL = "nogoon-crash"

        // Ensures we only install the crash handler once even if the module
        // is instantiated multiple times during the React Native bridge lifecycle.
        @Volatile private var crashHandlerInstalled = false

        // Request code for the VPN permission consent dialog
        private const val VPN_REQUEST_CODE = 7777
    }

    // Held while waiting for the VPN consent dialog result
    private var vpnStartPromise: Promise? = null

    // Receives the result of VpnService.prepare() → startActivityForResult
    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != VPN_REQUEST_CODE) return
            val promise = vpnStartPromise ?: return
            vpnStartPromise = null
            if (resultCode == Activity.RESULT_OK) {
                // User approved — now start the VPN service
                try {
                    val serviceIntent = Intent(reactApplicationContext, NoGoonVpnService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        reactApplicationContext.startForegroundService(serviceIntent)
                    } else {
                        reactApplicationContext.startService(serviceIntent)
                    }
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
        // Install an UncaughtExceptionHandler so that if the app crashes, the user
        // receives a notification explaining that blocking has paused.
        // NotificationManager.notify() posts to the system process, so it completes
        // successfully even though our process is about to exit.
        installCrashNotifier(reactContext)
        // Register for VPN consent dialog result
        reactContext.addActivityEventListener(activityEventListener)
        // Make sure the protection watchdog is scheduled. Idempotent (KEEP
        // policy) — this just confirms the periodic background check is
        // running, it doesn't reset its timer on every app launch.
        ProtectionWatchdogWorker.schedule(reactContext.applicationContext)
    }

    override fun getName(): String = NAME

    // ── Crash notification ────────────────────────────────────────────────────
    // Fires a high-priority local notification when the app crashes unexpectedly.
    // The notification title is intentionally calm: we don't want to alarm the user,
    // just let them know they should reopen NoGoon to restore blocking.

    private fun installCrashNotifier(context: ReactApplicationContext) {
        if (crashHandlerInstalled) return
        crashHandlerInstalled = true

        val appContext = context.applicationContext
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val channel = NotificationChannel(
                        CRASH_NOTIFICATION_CHANNEL,
                        "NoGoon alerts",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply { description = "Alerts when NoGoon needs attention" }
                    nm.createNotificationChannel(channel)
                }

                val launchIntent = appContext.packageManager
                    .getLaunchIntentForPackage(appContext.packageName)
                val pendingFlags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                val pending = PendingIntent.getActivity(appContext, 0, launchIntent, pendingFlags)

                val notification = NotificationCompat.Builder(appContext, CRASH_NOTIFICATION_CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_dialog_alert)
                    .setContentTitle("NoGoon stopped")
                    .setContentText("Blocking is paused. Tap to restart NoGoon.")
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setContentIntent(pending)
                    .build()

                nm.notify(CRASH_NOTIFICATION_ID, notification)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send crash notification", e)
            }
            // Always delegate to the default handler so Android can log the crash
            // and show the "App stopped" system dialog.
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    @ReactMethod
    fun setBlockedApps(packages: ReadableArray, promise: Promise) {
        try {
            val packageSet = mutableSetOf<String>()
            for (i in 0 until packages.size()) {
                val pkg = packages.getString(i)
                if (!pkg.isNullOrBlank()) packageSet.add(pkg)
            }

            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            prefs.edit()
                .putStringSet(KEY_BLOCKLIST, packageSet)
                .putBoolean(KEY_ENABLED, packageSet.isNotEmpty())
                .apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_BLOCKED_APPS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── setBlockedDomains ──────────────────────────────────────────────────────
    // Called from JavaScript whenever the user's website blocklist changes.
    // Saves the list of domains to SharedPreferences so the Accessibility Service
    // can read them when it detects a browser URL change.
    // Example: ["tiktok.com", "instagram.com", "reddit.com"]

    @ReactMethod
    fun setBlockedDomains(domains: ReadableArray, promise: Promise) {
        try {
            val domainSet = mutableSetOf<String>()
            for (i in 0 until domains.size()) {
                val domain = domains.getString(i)
                if (!domain.isNullOrBlank()) domainSet.add(domain.trim().lowercase())
            }

            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)

            // Also re-read the current app blocklist so we can correctly decide
            // whether the service should be active overall. The service is active
            // whenever EITHER list (apps OR domains) has items in it.
            val currentApps = prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()
            val serviceActive = domainSet.isNotEmpty() || currentApps.isNotEmpty()

            prefs.edit()
                .putStringSet(KEY_DOMAIN_BLOCKLIST, domainSet)
                .putBoolean(KEY_ENABLED, serviceActive)
                .apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_BLOCKED_DOMAINS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── setTemporaryUnlock ─────────────────────────────────────────────────────
    // Called from JavaScript (post-game.tsx) when the user chooses to unlock
    // a domain for 10 minutes after playing a game.
    //
    // We store the unlock expiry as a timestamp in SharedPreferences using the
    // key "unlock_{domain}". The Accessibility Service reads this before every
    // intercept — if the expiry is in the future, it lets the domain through.
    //
    // Arguments:
    //   domain       — e.g. "instagram.com"
    //   expiryMsStr  — Unix timestamp string (ms) when the unlock expires
    //                  Passed as a string because JS bridge can handle large numbers

    @ReactMethod
    fun setTemporaryUnlock(domain: String, expiryMsStr: String, promise: Promise) {
        try {
            val expiryMs = expiryMsStr.toLong()
            val key = "unlock_${domain.trim().lowercase()}"

            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            prefs.edit()
                .putLong(key, expiryMs)
                .apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_TEMP_UNLOCK_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── clearTemporaryUnlock ───────────────────────────────────────────────────
    // Explicitly removes an active temporary unlock. Called when the 10-minute
    // timer expires on the JS side, as a safety fallback (the service also
    // checks expiry independently).

    @ReactMethod
    fun clearTemporaryUnlock(domain: String, promise: Promise) {
        try {
            val key = "unlock_${domain.trim().lowercase()}"
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            prefs.edit().remove(key).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_TEMP_UNLOCK_ERROR", e.message ?: "Unknown error", e)
        }
    }

    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        try {
            val enabledServices = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            val ourPackage = reactApplicationContext.packageName
            promise.resolve(enabledServices.contains(ourPackage, ignoreCase = true))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── isBatteryOptimized ────────────────────────────────────────────────────
    // Returns true if Android's battery optimization is still active for NoGoon.
    // When battery optimization is on, Android can kill the Accessibility Service
    // in the background — which breaks blocking. We tell the user to disable it.

    @ReactMethod
    fun isBatteryOptimized(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = reactApplicationContext.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
                val packageName = reactApplicationContext.packageName
                // isIgnoringBatteryOptimizations = true means we are EXEMPTED (good)
                // We return true if battery optimization is STILL ON (bad for us)
                promise.resolve(!pm.isIgnoringBatteryOptimizations(packageName))
            } else {
                // Below Android 6 — battery optimization doesn't apply
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ── openBatteryOptimizationSettings ──────────────────────────────────────
    // Opens the system dialog that lets the user exempt NoGoon from battery
    // optimization. This is required for the Accessibility Service to run
    // reliably in the background without being killed by Android.

    @ReactMethod
    fun openBatteryOptimizationSettings(promise: Promise) {
        try {
            val packageName = reactApplicationContext.packageName
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Direct deep link to this app's battery settings — one tap to fix
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                // Fallback: general battery settings on older Android
                Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_BATTERY_SETTINGS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── openOemAutostartSettings ──────────────────────────────────────────────
    // Many OEM Android skins (MIUI, ColorOS, FuntouchOS/OriginOS, One UI, and
    // others) run their OWN battery/autostart manager on top of stock Android's
    // Doze exemption — a user can grant us REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
    // and the OEM layer can still silently kill the Accessibility Service.
    // There is no public API to query or request this state, so the best we
    // can do is deep-link straight to the manufacturer's settings screen and
    // let the user enable "Autostart" / "No restrictions" themselves.
    //
    // We try each known ComponentName for this device's manufacturer, and
    // fall back to this app's generic App Info screen if every deep link
    // fails (an OEM can change or remove these screens between OS versions).
    // Resolves true when a manufacturer-specific screen opened, false when we
    // had to fall back to the generic App Info screen — JS uses this to show
    // an honest "opened general settings instead" note rather than implying
    // the specific autostart toggle was found.

    @ReactMethod
    fun openOemAutostartSettings(promise: Promise) {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val componentCandidates: List<ComponentName> = when {
            manufacturer.contains("xiaomi") -> listOf(
                ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
                ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings")
            )
            manufacturer.contains("oppo") -> listOf(
                ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
                ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")
            )
            manufacturer.contains("realme") -> listOf(
                ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")
            )
            manufacturer.contains("oneplus") -> listOf(
                ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
                ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
            )
            manufacturer.contains("vivo") -> listOf(
                ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
                ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
                ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
            )
            manufacturer.contains("samsung") -> listOf(
                ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"),
                ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity")
            )
            else -> emptyList()
        }

        for (component in componentCandidates) {
            try {
                val intent = Intent().apply {
                    setComponent(component)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
                return
            } catch (e: Exception) {
                // This screen doesn't exist on this device/OS version — try the next one
            }
        }

        // Fallback: this app's generic App Info screen (always exists)
        try {
            val packageName = reactApplicationContext.packageName
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("OPEN_OEM_SETTINGS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── Grayscale preference ──────────────────────────────────────────────────
    // Stores whether the dim overlay should fire when the gate launches.
    // The preference is read directly by NoGoonAccessibilityService from the
    // same SharedPreferences instance ("NoGoonBlocker").

    // ── blockingPaused (QS tile) ──────────────────────────────────────────────
    // The Quick Settings tile writes "blockingPausedUntil" (ms timestamp) to
    // SharedPreferences. These two methods let JS read and clear that value so
    // the UI can reflect the paused state and offer a "Resume" button.
    //
    // isBlockingPaused() returns the pausedUntil timestamp as a Double so JS
    // can compute both whether blocking is paused AND how many minutes remain.
    // Returns 0.0 when not paused.
    //
    // setBlockingPaused(true)  → writes now + 30 min
    // setBlockingPaused(false) → writes 0 (clears the pause)

    // ── focusSessionEnd (focus session hard-lock) ─────────────────────────────
    // Called by JS when a focus session starts or ends. Writes the expiry
    // timestamp to SharedPreferences so the Accessibility Service can read it
    // and refuse to honour the QS tile pause during an active session.
    // endMs = 0 clears the session (no active focus session).

    @ReactMethod
    fun setFocusSessionEnd(endMs: Double, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            prefs.edit().putLong("focusSessionEnd", endMs.toLong()).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_FOCUS_SESSION_ERROR", e.message ?: "Unknown error", e)
        }
    }

    @ReactMethod
    fun isBlockingPaused(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            promise.resolve(prefs.getLong("blockingPausedUntil", 0L).toDouble())
        } catch (e: Exception) {
            promise.resolve(0.0)
        }
    }

    @ReactMethod
    fun setBlockingPaused(paused: Boolean, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            val until = if (paused) System.currentTimeMillis() + 30 * 60 * 1000L else 0L
            prefs.edit().putLong("blockingPausedUntil", until).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_PAUSED_ERROR", e.message ?: "Unknown error", e)
        }
    }

    @ReactMethod
    fun setGrayscaleEnabled(enabled: Boolean, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            prefs.edit().putBoolean("grayscale_enabled", enabled).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_GRAYSCALE_ERROR", e.message ?: "Unknown error", e)
        }
    }

    @ReactMethod
    fun isGrayscaleEnabled(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            promise.resolve(prefs.getBoolean("grayscale_enabled", false))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ── openGrayscaleSettings ─────────────────────────────────────────────────
    // Opens Android Accessibility Settings where the user can enable
    // "Color Correction → Grayscale" to desaturate the phone display and reduce
    // visual dopamine stimulation.  Programmatic grayscale requires
    // WRITE_SECURE_SETTINGS (a signature-level permission not available to Play
    // Store apps), so this is the best we can do: get the user one tap away.

    @ReactMethod
    fun openGrayscaleSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_GRAYSCALE_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── VPN Service (Network Shield) ──────────────────────────────────────────
    //
    // Starts / stops NoGoonVpnService, which intercepts DNS queries to block
    // domains at the network layer. This is the second protection layer.
    //
    // IMPORTANT: VpnService.prepare(context) must be called first (in JS, via
    // the system VPN permission dialog). After the user approves once, Android
    // remembers it. We check VpnService.prepare() return value in the JS hook
    // and only call startVpn() after the user has granted permission.

    @ReactMethod
    fun startVpn(promise: Promise) {
        try {
            // prepare() returns an Intent if the user hasn't approved this VPN yet (null = approved)
            val prepareIntent = android.net.VpnService.prepare(reactApplicationContext)
            if (prepareIntent != null) {
                // Show the Android system VPN consent dialog via startActivityForResult.
                // The result arrives in activityEventListener.onActivityResult().
                val activity = reactApplicationContext.currentActivity
                if (activity == null) {
                    promise.reject("VPN_NO_ACTIVITY", "No foreground activity available")
                    return
                }
                vpnStartPromise = promise
                activity.startActivityForResult(prepareIntent, VPN_REQUEST_CODE)
                return
            }
            // Already approved — start the service directly
            val serviceIntent = Intent(reactApplicationContext, NoGoonVpnService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(serviceIntent)
            } else {
                reactApplicationContext.startService(serviceIntent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VPN_START_ERROR", e.message ?: "Unknown error", e)
        }
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, NoGoonVpnService::class.java).apply {
                action = NoGoonVpnService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VPN_STOP_ERROR", e.message ?: "Unknown error", e)
        }
    }

    @ReactMethod
    fun isVpnActive(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            val flagSet = prefs.getBoolean("vpnRunning", false)
            if (!flagSet) {
                promise.resolve(false)
                return
            }
            // Validate with heartbeat: if the service was SIGKILL'd, onDestroy()
            // never ran, so the flag is stale. The heartbeat timestamp goes stale
            // after ~10s (written every 5s by the packet loop).
            val heartbeat = prefs.getLong("vpnHeartbeat", 0L)
            val age = System.currentTimeMillis() - heartbeat
            if (age > 10_000L) {
                // Service is gone — clear stale flag
                prefs.edit().putBoolean("vpnRunning", false).remove("vpnHeartbeat").apply()
                promise.resolve(false)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // Returns true if the user has already granted the one-time VPN consent.
    // VpnService.prepare() returns null when permission is already held.
    // Used by the UI to distinguish "VPN off, never set up" from "VPN off, was set up before".
    @ReactMethod
    fun isVpnPermissionGranted(promise: Promise) {
        try {
            val needsConsent = android.net.VpnService.prepare(reactApplicationContext) != null
            promise.resolve(!needsConsent)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ── Notification Filter ───────────────────────────────────────────────────
    //
    // The actual filtering happens inside NoGoonNotificationListener.kt.
    // This method just writes the toggle to SharedPreferences — the listener
    // reads it on every incoming notification.

    @ReactMethod
    fun setNotificationFilterEnabled(enabled: Boolean, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            prefs.edit().putBoolean("notificationFilterEnabled", enabled).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_NOTIF_FILTER_ERROR", e.message ?: "Unknown error", e)
        }
    }

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        try {
            val enabledListeners = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                "enabled_notification_listeners"
            ) ?: ""
            val ourPackage = reactApplicationContext.packageName
            promise.resolve(enabledListeners.contains(ourPackage, ignoreCase = true))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openNotificationListenerSettings(promise: Promise) {
        try {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            // Fallback for older Android versions
            try {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("OPEN_NOTIF_SETTINGS_ERROR", e2.message ?: "Unknown error", e2)
            }
        }
    }

    // ── VPN Domain Log ────────────────────────────────────────────────────────
    //
    // Returns the last 20 blocked domains as a JSON string:
    // [{"domain":"ads.twitter.com","ts":1722345678000}, ...]
    // Written by NoGoonVpnService.logBlockedDomain() each time a domain is blocked.

    @ReactMethod
    fun getVpnDomainLog(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            val log = prefs.getString("vpnDomainLog", "[]") ?: "[]"
            promise.resolve(log)
        } catch (e: Exception) {
            promise.resolve("[]")
        }
    }

    // ── setCurfew ─────────────────────────────────────────────────────────────
    // Called from JS (useAppBlocker) when the user changes curfew settings.
    // Writes the curfew config to SharedPreferences so the Accessibility Service
    // can enforce it natively without waiting for JS to load.
    //
    // Arguments:
    //   enabled   — whether curfew is active
    //   startTime — "HH:mm" string, e.g. "22:00"
    //   endTime   — "HH:mm" string, e.g. "07:00"

    @ReactMethod
    fun setCurfew(enabled: Boolean, startTime: String, endTime: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            prefs.edit()
                .putBoolean(NoGoonAccessibilityService.KEY_CURFEW_ENABLED, enabled)
                .putString(NoGoonAccessibilityService.KEY_CURFEW_START, startTime)
                .putString(NoGoonAccessibilityService.KEY_CURFEW_END, endTime)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_CURFEW_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ── getUnlockTimeLog ──────────────────────────────────────────────────────
    // Returns the last 7 days of unlock-time data as a JSON string:
    // {"2026-08-01": 300000, "2026-08-02": 120000}
    // Values are in milliseconds. Written by NoGoonAccessibilityService when
    // the user leaves a temporarily-unlocked blocked app.

    @ReactMethod
    fun getUnlockTimeLog(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            val prefix = "unlock_time_"
            val result = org.json.JSONObject()
            for ((key, value) in prefs.all) {
                if (key.startsWith(prefix) && value is Long) {
                    val dateKey = key.removePrefix(prefix)
                    result.put(dateKey, value)
                }
            }
            promise.resolve(result.toString())
        } catch (e: Exception) {
            promise.resolve("{}")
        }
    }

    // ── setTodayStats ─────────────────────────────────────────────────────────
    // Called from JS after every walk-away to keep the home screen widget in sync.
    // The widget reads these values directly from SharedPreferences.
    //
    // Arguments:
    //   walkAways — today's walk-away count
    //   streak    — current streak (days)

    @ReactMethod
    fun setTodayStats(walkAways: Int, streak: Int, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, 0)
            val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                .format(java.util.Date())
            prefs.edit()
                .putInt("widget_walk_aways_today", walkAways)
                .putInt("widget_streak", streak)
                .putString("widget_date", today)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_TODAY_STATS_ERROR", e.message ?: "Unknown error", e)
        }
    }
}
