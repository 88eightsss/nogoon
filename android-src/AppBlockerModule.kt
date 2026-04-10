// ─── AppBlocker Native Module ─────────────────────────────────────────────────
//
// Bridge between React Native JavaScript and Android system features.
// Exposes three functions to JS:
//   setBlockedApps(packages)      — updates the blocklist in SharedPreferences
//   isServiceEnabled()            — checks if Accessibility permission is granted
//   openAccessibilitySettings()   — opens Android's Accessibility Settings screen

package com.nogoon.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
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
    }

    override fun getName(): String = NAME

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
}
