// ═══════════════════════════════════════════════════════════════════════════
//  GATE Accessibility Service
//  ──────────────────────────
//  This is the Android background service that watches which app the user
//  opens. When a blocked app comes to the foreground, this service immediately
//  launches the GATE intercept screen.
//
//  HOW IT WORKS:
//  1. Android grants this service special "Accessibility" permission
//  2. Every time any app window changes (user switches apps), Android calls
//     onAccessibilityEvent() in this file
//  3. We check if that app's package name is in the user's blocklist
//  4. If it is, we fire a deep link: gate://gate?domain=com.instagram.android
//  5. GATE opens full-screen, interrupting the user before they scroll
//
//  IMPORTANT: This service only runs when the user has explicitly granted
//  Accessibility permission in Android Settings. We never enable it silently.
// ═══════════════════════════════════════════════════════════════════════════

package com.gate.app

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.view.accessibility.AccessibilityEvent

class GateAccessibilityService : AccessibilityService() {

    // ─── Constants ─────────────────────────────────────────────────────────────
    // These keys must match exactly what AppBlockerModule.kt writes to SharedPreferences.
    // SharedPreferences is like a small key-value database on the device —
    // it lets the Accessibility Service (which runs separately) read the blocklist
    // that the React Native app writes.

    companion object {
        const val PREFS_NAME      = "GateBlocker"          // the storage file name
        const val KEY_BLOCKLIST   = "blockedPackages"      // set of package names to block
        const val KEY_ENABLED     = "serviceActive"        // boolean: is blocking on?
        const val COOLDOWN_MS     = 3_000L                 // 3 seconds between triggers per app
    }

    // Track the last time we triggered for each package (to avoid rapid re-firing)
    private val recentlyTriggered = mutableMapOf<String, Long>()

    // ─── Packages that are NEVER blocked ───────────────────────────────────────
    // These are system apps, launchers, and GATE itself.
    // Without this list, we could accidentally block the phone's home screen
    // or the GATE app itself, which would break everything.

    private val neverBlock = setOf(
        // GATE itself
        "com.gate.app",

        // Common Android launchers (home screen)
        "com.android.launcher",
        "com.android.launcher2",
        "com.android.launcher3",
        "com.google.android.apps.nexuslauncher",    // Pixel launcher
        "com.miui.home",                             // Xiaomi
        "com.huawei.android.launcher",              // Huawei
        "com.sec.android.app.launcher",             // Samsung
        "com.oppo.launcher",
        "com.realme.launcher",
        "com.oneplus.launcher",

        // Android system UI (status bar, notifications, etc.)
        "com.android.systemui",
        "com.android.settings",
        "android",

        // Phone & messaging (never block calls)
        "com.android.phone",
        "com.android.dialer",
        "com.google.android.dialer",
    )

    // ═══════════════════════════════════════════════════════════════════════════
    //  onAccessibilityEvent — called by Android for EVERY window change
    // ═══════════════════════════════════════════════════════════════════════════

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We only care about TYPE_WINDOW_STATE_CHANGED — this fires when the
        // user switches to a new app or a new activity opens.
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        // Get the package name of the app that just opened
        val packageName = event.packageName?.toString() ?: return
        if (packageName.isBlank()) return

        // Skip system/launcher packages
        if (neverBlock.any { packageName.startsWith(it) }) return

        // ── Read settings from SharedPreferences ─────────────────────────────
        // We read fresh from storage each time so changes from the JS app
        // are picked up immediately without needing to restart the service.

        val prefs: SharedPreferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        // If the user has turned off app blocking, do nothing
        if (!prefs.getBoolean(KEY_ENABLED, false)) return

        // Get the current blocklist (a set of package name strings)
        val blockedSet = prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()

        // Only proceed if this app is actually on the blocklist
        if (!blockedSet.contains(packageName)) return

        // ── Cooldown check ───────────────────────────────────────────────────
        // Don't trigger again for the same app within 3 seconds.
        // Without this, the service could fire multiple times as the app
        // loads its various activities (splash screen → main screen → etc.)

        val now = System.currentTimeMillis()
        val lastTrigger = recentlyTriggered[packageName] ?: 0L
        if (now - lastTrigger < COOLDOWN_MS) return

        recentlyTriggered[packageName] = now

        // ── FIRE! Launch GATE ─────────────────────────────────────────────────
        launchGate(packageName)
    }

    // ─── launchGate ────────────────────────────────────────────────────────────
    // Opens the GATE app via a deep link URL, passing the blocked package name
    // as the "domain" parameter (e.g. gate://gate?domain=com.instagram.android)
    //
    // FLAG_ACTIVITY_NEW_TASK is required when starting an activity from a
    // service (not from another activity).

    private fun launchGate(blockedPackage: String) {
        try {
            val uri = Uri.parse(
                "gate://gate?domain=${Uri.encode(blockedPackage)}&confidence=95&source=app"
            )
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Silent fail — if something goes wrong (GATE not installed, etc.),
            // we don't want to crash the service or interrupt the user's phone.
        }
    }

    // ─── onInterrupt ───────────────────────────────────────────────────────────
    // Required by Android — called when the system interrupts the service
    // (e.g., user turns off accessibility in settings mid-session).
    // We don't need to do anything here.

    override fun onInterrupt() {
        // Intentionally empty
    }
}
