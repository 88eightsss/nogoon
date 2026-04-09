// ─── AppBlocker Native Module ─────────────────────────────────────────────────
//
// Bridge between React Native JavaScript and Android system features.
// Exposes three functions to JS:
//   setBlockedApps(packages)      — updates the blocklist in SharedPreferences
//   isServiceEnabled()            — checks if Accessibility permission is granted
//   openAccessibilitySettings()   — opens Android's Accessibility Settings screen

package com.nogoon.app

import android.content.Intent
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
            prefs.edit()
                .putStringSet(KEY_DOMAIN_BLOCKLIST, domainSet)
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
}
