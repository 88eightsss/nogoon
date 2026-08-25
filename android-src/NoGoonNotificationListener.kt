package com.nogoon.app

// ─── NoGoonNotificationListener ──────────────────────────────────────────────
//
// A NotificationListenerService that silently cancels notifications from
// blocked apps. This is the third protection layer.
//
// WHY THIS EXISTS:
//   When NoGoon blocks an app, the app can still send notifications — and
//   those notifications become a backdoor. "You have 3 new messages" is
//   engineered to trigger the same craving the blocker is trying to prevent.
//   Silencing notifications from blocked apps closes that loop.
//
// HOW IT WORKS:
//   Android calls onNotificationPosted() for every notification on the device
//   (from any app). We check if the posting app is in the blocked list.
//   If it is, we call cancelNotification() before the user sees it.
//
// SETUP:
//   The user must grant Notification Access in Android Settings once.
//   There is no programmatic way to grant this — it requires one user tap.
//   We send them directly to the settings screen via openNotificationListenerSettings().
//
// TOGGLING:
//   Enabling/disabling this is purely a UI-layer toggle — we read a
//   "notificationFilterEnabled" pref and only suppress when it's true.
//   Android always calls this service if the user granted access; we
//   just choose whether to act on each notification.

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class NoGoonNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG         = "NoGoonNotifListener"
        private const val PREFS_NAME  = "NoGoonBlocker"
        private const val FILTER_KEY  = "notificationFilterEnabled"
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        val prefs = getSharedPreferences(PREFS_NAME, 0)

        // Respect the user's toggle — if filter is off, let everything through
        if (!prefs.getBoolean(FILTER_KEY, false)) return

        val packageName = sbn.packageName ?: return

        if (isAppBlocked(prefs, packageName)) {
            Log.d(TAG, "Suppressing notification from blocked app: $packageName")
            try {
                cancelNotification(sbn.key)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to cancel notification: ${e.message}")
            }
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // No action needed — we only intercept, not track
    }

    // ── Check if an app package is in the blocked list ─────────────────────────
    //
    // The blocklist is stored as a StringSet under "blockedPackages" by
    // AppBlockerModule.setBlockedApps(). We read the same key here so the
    // notification filter and the accessibility service block the same apps.

    private fun isAppBlocked(prefs: android.content.SharedPreferences, packageName: String): Boolean {
        val blocked = prefs.getStringSet("blockedPackages", emptySet()) ?: emptySet()
        return blocked.contains(packageName)
    }
}
