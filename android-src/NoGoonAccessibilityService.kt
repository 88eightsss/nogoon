// ═══════════════════════════════════════════════════════════════════════════
//  NoGoon Accessibility Service
//  ─────────────────────────────
//  Background Android service that watches which app the user opens.
//  When a blocked app comes to the foreground, this service immediately
//  launches the NoGoon intercept screen.
//
//  HOW IT WORKS:
//  1. Android grants this service the "Accessibility" permission
//  2. Every time any app window changes (user switches apps), Android calls
//     onAccessibilityEvent() in this file
//  3. We check if that app's package name is in the user's blocklist
//  4. If it is, we fire a deep link: nogoon://nogoon?domain=com.instagram.android
//  5. NoGoon opens full-screen, interrupting the user before they scroll
// ═══════════════════════════════════════════════════════════════════════════

package com.nogoon.app

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.view.accessibility.AccessibilityEvent

class NoGoonAccessibilityService : AccessibilityService() {

    companion object {
        const val PREFS_NAME    = "NoGoonBlocker"
        const val KEY_BLOCKLIST = "blockedPackages"
        const val KEY_ENABLED   = "serviceActive"
        const val COOLDOWN_MS   = 3_000L
    }

    private val recentlyTriggered = mutableMapOf<String, Long>()

    // Packages that are NEVER blocked — system essentials, launchers, NoGoon itself
    private val neverBlock = setOf(
        "com.nogoon.app",
        "com.android.launcher", "com.android.launcher2", "com.android.launcher3",
        "com.google.android.apps.nexuslauncher",
        "com.miui.home", "com.huawei.android.launcher",
        "com.sec.android.app.launcher", "com.oppo.launcher",
        "com.realme.launcher", "com.oneplus.launcher",
        "com.android.systemui", "com.android.settings", "android",
        "com.android.phone", "com.android.dialer", "com.google.android.dialer",
    )

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return
        if (packageName.isBlank()) return
        if (neverBlock.any { packageName.startsWith(it) }) return

        val prefs: SharedPreferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ENABLED, false)) return

        val blockedSet = prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()
        if (!blockedSet.contains(packageName)) return

        val now = System.currentTimeMillis()
        val lastTrigger = recentlyTriggered[packageName] ?: 0L
        if (now - lastTrigger < COOLDOWN_MS) return

        recentlyTriggered[packageName] = now
        launchNoGoon(packageName)
    }

    private fun launchNoGoon(blockedPackage: String) {
        try {
            val uri = Uri.parse(
                "nogoon://nogoon?domain=${Uri.encode(blockedPackage)}&confidence=95&source=app"
            )
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Silent fail — if NoGoon isn't installed or link fails, do nothing
        }
    }

    override fun onInterrupt() { /* Required override — intentionally empty */ }
}
