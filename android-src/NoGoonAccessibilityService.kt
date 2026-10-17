// ═══════════════════════════════════════════════════════════════════════════
//  NoGoon Accessibility Service
//  ─────────────────────────────
//  Background Android service that watches both:
//
//    1. APP BLOCKING  — detects when a blocked app opens (Instagram, TikTok, etc.)
//    2. WEB BLOCKING  — detects when Chrome/Firefox navigates to a blocked domain
//
//  HOW APP BLOCKING WORKS:
//    TYPE_WINDOW_STATE_CHANGED fires whenever the user switches apps, but also
//    for in-app dialogs and popups. We track the last foreground package and
//    only trigger when it actually changes, preventing false re-triggers on
//    dialogs within an already-open blocked app.
//
//    IMPORTANT: currentForegroundPackage is updated for ALL packages, including
//    launchers and system apps — otherwise returning to a blocked app after
//    visiting the home screen would be skipped as a "duplicate" event.
//
//  HOW WEB BLOCKING WORKS:
//    TYPE_WINDOW_CONTENT_CHANGED fires whenever any text on screen changes —
//    potentially hundreds of times per second on a live page. We debounce to
//    500ms per browser and skip the tree walk entirely if the visible domain
//    hasn't changed since the last check.
//
//  PERFORMANCE DESIGN:
//    - SharedPreferences is cached as a class-level instance (initialized once
//      in onServiceConnected) to avoid Context lookups in the hot path.
//    - Cooldown timestamps are stored in SharedPreferences (prefixed "cooldown_")
//      so the 3s cooldown survives Android killing and restarting this service
//      under battery pressure.
//    - Stale cooldown_ and unlock_ keys are pruned on service connect so
//      SharedPreferences doesn't grow unbounded over time.
//    - Two short-circuit layers in handleBrowserUrl prevent expensive node tree
//      walks on high-frequency events: time debounce, then URL domain cache.
//    - findUrlByTextScan is depth-limited to 12 levels to prevent stack overflow
//      on pathologically deep accessibility trees.
// ═══════════════════════════════════════════════════════════════════════════

package com.nogoon.app

import android.accessibilityservice.AccessibilityService
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.app.NotificationCompat

class NoGoonAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG              = "NoGoon"
        const val PREFS_NAME           = "NoGoonBlocker"
        const val KEY_BLOCKLIST        = "blockedPackages"   // app package names
        const val KEY_DOMAIN_BLOCKLIST = "blockedDomains"   // website domains
        const val KEY_ENABLED          = "serviceActive"
        // Was 3_000L. That window let a user back out of the gate (Recents /
        // task switcher) and reopen the SAME blocked app a moment later while
        // still "on cooldown" — the trigger for that genuine second attempt was
        // silently swallowed, so the app opened with no gate at all. This cooldown
        // exists to survive duplicate accessibility events firing for one single
        // switch, and to survive the service being killed/restarted by the OS
        // mid-launch (see the class-level doc comment) — neither of those needs
        // more than ~1-1.5s in practice, while a human deliberately backing out to
        // Recents and tapping back in realistically takes 1.5-2s+. Shortened so
        // that real re-attempts still get gated, while still covering the
        // millisecond-scale event races and restart window this was built for.
        const val COOLDOWN_MS               = 1_500L             // 1.5s between triggers for same target
        const val URL_DEBOUNCE_MS           = 500L               // min ms between URL tree walks per browser
        private const val KEY_COOLDOWN_PREFIX     = "cooldown_"      // prefix for persisted cooldown keys
        private const val KEY_RAPID_LAST_MS_PREFIX = "rapid_last_ms_" // when gate last fired per target
        private const val KEY_RAPID_COUNT_PREFIX   = "rapid_count_"   // consecutive rapid-return count
        private const val RAPID_WINDOW_MS     = 3L * 60 * 1000  // 3-minute rapid re-entry window
        private const val RAPID_LOCKOUT_COUNT = 5               // trigger lockout after this many rapid returns
        private const val RAPID_LOCKOUT_MS    = 10L * 60 * 1000 // 10-minute hard lockout duration
        private const val KEY_LOCKOUT_UNTIL_PREFIX = "lockout_until_"  // per-target end of the rapid-return lockout

        // ── Digital Curfew (Sleep Mode) ───────────────────────────────────────
        // Written by AppBlockerModule.setCurfew() when JS curfew settings change.
        // Stored as "HH:mm" strings and a boolean enable flag.
        const val KEY_CURFEW_ENABLED = "curfew_enabled"
        const val KEY_CURFEW_START   = "curfew_start"   // e.g. "22:00"
        const val KEY_CURFEW_END     = "curfew_end"     // e.g. "07:00"

        // ── Modes / Presets ────────────────────────────────────────────────────
        // Written by AppBlockerModule.setModesConfig() whenever the user's Modes
        // list or manually-selected "current" mode changes. See
        // resolveActiveModeJson() / activeBlockedApps() / activeBlockedDomains()
        // below for how this is resolved live, the same way curfew is above.
        const val KEY_MODES_JSON     = "modes_config_json" // JSON array of modes
        const val KEY_ACTIVE_MODE_ID = "active_mode_id"    // manually-selected fallback mode id

        // ── Unlock-time tracking ──────────────────────────────────────────────
        // When a user unlocks a blocked app and enters it, track how long they
        // spend there before switching away.  Written per-day as running totals.
        // Key format: "unlock_time_YYYY-MM-DD" → total ms spent in unlocked apps.
        private const val KEY_UNLOCK_TIME_PREFIX = "unlock_time_"

        // ── Crash guard ───────────────────────────────────────────────────────
        // Prevents double-launches when rapid clicking causes multiple events
        // (e.g. TYPE_WINDOW_STATE_CHANGED + TYPE_WINDOW_CONTENT_CHANGED) to pass
        // the 3s cooldown check before the gate Activity has fully initialized.
        private const val GATE_LAUNCH_DEBOUNCE_MS = 1_000L      // min ms between any two gate launches

        // ── Scroll detection ──────────────────────────────────────────────────
        // Fires a "scroll check-in" gate when the user has been scrolling a
        // blocked app or site for 90 seconds straight without a 30s idle break.
        private const val SCROLL_GATE_TRIGGER_MS     = 90_000L         // 90s of continuous scrolling → trigger
        private const val SCROLL_IDLE_RESET_MS        = 30_000L        // 30s idle = end of scroll session
        private const val SCROLL_CHECK_DEBOUNCE_MS    = 2_000L         // max one scroll check per 2s per package
        private const val KEY_SCROLL_COOLDOWN_PREFIX  = "scrollcool_"  // prefs prefix for scroll gate cooldown
        private const val SCROLL_GATE_COOLDOWN_MS     = 5L * 60 * 1000 // 5 min between scroll gates per target

        // ── Grayscale overlay ─────────────────────────────────────────────────
        // When enabled, a dark overlay appears over the blocked content for ~1.5s
        // before the gate launches — creating a visual "shock" that breaks the
        // scroll/browsing trance.  Uses TYPE_ACCESSIBILITY_OVERLAY so no extra
        // permission is needed beyond the accessibility service grant.
        private const val KEY_GRAYSCALE_ENABLED = "grayscale_enabled"
        private const val OVERLAY_DISMISS_MS    = 1_500L
        // Set by the QS tile — ms timestamp until which blocking is paused (0 = not paused)
        private const val KEY_PAUSED_UNTIL      = "blockingPausedUntil"
        // Set by JS when a focus session is active — ms timestamp when it ends (0 = none)
        // Focus sessions override the QS tile pause so the hard-lock can't be bypassed.
        private const val KEY_FOCUS_SESSION_END = "focusSessionEnd"

        // ── Persistent "protection active" notification ─────────────────────────
        // A low-priority, silent, ongoing notification shown for as long as this
        // service is connected. It exists purely so the user can SEE that blocking
        // is running (and so Android is less likely to silently kill the service —
        // a foreground service is much lower priority for the OS to reclaim under
        // memory pressure than a plain background accessibility service).
        private const val PROTECTION_NOTIFICATION_CHANNEL = "nogoon_protection_active"
        private const val PROTECTION_NOTIFICATION_ID       = 4242
    }

    // SharedPreferences cached at class level — initialized once in onServiceConnected.
    // After first load, all reads are in-memory HashMap lookups. Writes use apply() (async).
    private lateinit var prefs: SharedPreferences

    // URL debounce state — in-memory only, no need to survive service restarts.
    // lastBrowserCheckMs: timestamp of last node tree walk per browser package.
    // lastSeenUrl:        last domain we extracted per browser — skip blocklist if unchanged.
    private val lastBrowserCheckMs = mutableMapOf<String, Long>()
    private val lastSeenUrl        = mutableMapOf<String, String>()

    // Track the currently foregrounded package to prevent TYPE_WINDOW_STATE_CHANGED
    // from firing on in-app dialogs and popups as if they were app switches.
    // Updated for ALL packages (including launchers) so returning to a blocked app
    // after visiting home is always detected as a new switch.
    private var currentForegroundPackage: String = ""

    // Service-level gate launch debounce — prevents crash from rapid-fire startActivity
    // calls when multiple events pass the per-target cooldown before the gate Activity
    // finishes initializing, or when the user rapidly taps a blocked site.
    private var lastGateLaunchMs = 0L

    // Scroll session tracking — in-memory, reset on service restart.
    // scrollSessionStartMs: when the current unbroken scroll session began, per blocking target.
    // lastScrollEventMs:    timestamp of the last scroll event per target (for idle detection).
    // scrollDebounceMs:     last time we ran scroll logic per package (cheap rate-limit).
    private val scrollSessionStartMs = mutableMapOf<String, Long>()
    private val lastScrollEventMs    = mutableMapOf<String, Long>()
    private val scrollDebounceMs     = mutableMapOf<String, Long>()

    // Grayscale overlay — managed on the main thread via handler.
    private var grayscaleOverlay: View? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    // ── Unlock-time tracking ──────────────────────────────────────────────────
    // When a temporarily-unlocked target comes to the foreground, we record the
    // entry timestamp.  When the user leaves (a different package foregrounds),
    // we add the elapsed time to today's running total in SharedPreferences.
    //
    // In-memory only — no need to survive a service restart since a restart
    // happens precisely when the screen changes, ending any active session.
    private val unlockEntryMs = mutableMapOf<String, Long>()

    // ── Packages that are NEVER blocked ───────────────────────────────────────
    // System essentials, launchers, NoGoon itself, and all known browsers.
    // Browsers are excluded from APP blocking but handled via URL detection below.

    private val neverBlock = setOf(
        "com.nogoon.app",
        "com.android.launcher", "com.android.launcher2", "com.android.launcher3",
        "com.google.android.apps.nexuslauncher",
        "com.miui.home", "com.huawei.android.launcher",
        "com.sec.android.app.launcher", "com.oppo.launcher",
        "com.realme.launcher", "com.oneplus.launcher",
        "com.android.systemui", "com.android.settings", "android",
        "com.android.phone", "com.android.dialer", "com.google.android.dialer",
        // Browsers — handled via URL detection, not package name blocking
        "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
        "org.mozilla.firefox", "org.mozilla.firefox_beta",
        "com.brave.browser", "com.microsoft.emmx", "com.opera.browser",
        "com.opera.mini.native", "com.sec.android.app.sbrowser",
        "com.duckduckgo.mobile.android", "com.vivaldi.browser", "com.mi.globalbrowser",
    )

    // ── Packages exempt from Digital Curfew ───────────────────────────────────
    // Same as neverBlock MINUS browsers: during curfew the whole browser is blocked
    // (not just specific URLs), so browsers must NOT be exempt here.

    private val curfewNeverBlock = setOf(
        "com.nogoon.app",
        "com.android.launcher", "com.android.launcher2", "com.android.launcher3",
        "com.google.android.apps.nexuslauncher",
        "com.miui.home", "com.huawei.android.launcher",
        "com.sec.android.app.launcher", "com.oppo.launcher",
        "com.realme.launcher", "com.oneplus.launcher",
        "com.android.systemui", "com.android.settings", "android",
        "com.android.phone", "com.android.dialer", "com.google.android.dialer",
        // Things that must keep working at night: alarms, in-call UI, permission
        // prompts and keyboards (a keyboard window opens on top of whatever app you type in).
        "com.google.android.deskclock", "com.android.deskclock", "com.sec.android.app.clockpackage",
        "com.android.incallui", "com.samsung.android.incallui",
        "com.google.android.permissioncontroller", "com.android.permissioncontroller",
        "com.google.android.inputmethod", "com.android.inputmethod", "com.samsung.android.honeyboard",
        "com.touchtype.swiftkey", "com.swiftkey",
    )

    // ── Known browser packages — URL detection runs for these ─────────────────

    private val browserPackages = setOf(
        "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
        "org.mozilla.firefox", "org.mozilla.firefox_beta",
        "com.brave.browser", "com.microsoft.emmx", "com.opera.browser",
        "com.opera.mini.native", "com.sec.android.app.sbrowser",
        "com.duckduckgo.mobile.android", "com.vivaldi.browser", "com.mi.globalbrowser",
    )

    // ── Service lifecycle ─────────────────────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        // Cache the prefs instance once — avoids getSharedPreferences() in the hot event path
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        // Remove accumulated stale keys from prior sessions
        pruneExpiredKeys()
        // Show the persistent "protection active" notification and mark this
        // service as a foreground service (see PROTECTION_NOTIFICATION_ID above).
        startProtectionForeground()
    }

    override fun onUnbind(intent: Intent?): Boolean {
        // The system unbinds an accessibility service when the user disables it
        // in Settings (or a crash tears the connection down). Either way, drop
        // the foreground state and clear the notification along with it.
        try {
            stopForeground(Service.STOP_FOREGROUND_REMOVE)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop foreground on unbind", e)
        }
        return super.onUnbind(intent)
    }

    // ── Persistent "protection active" notification ──────────────────────────
    // Low-priority (IMPORTANCE_LOW / PRIORITY_LOW), silent, ongoing — it should
    // never make noise or vibrate, it's purely a visible "NoGoon is running"
    // indicator that also lets Android treat this as a foreground service.
    // Tapping it opens the app; it cannot be swiped away while protection runs.
    private fun startProtectionForeground() {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    PROTECTION_NOTIFICATION_CHANNEL,
                    "Protection status",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Shows when NoGoon's app blocker is actively running"
                    setShowBadge(false)
                }
                nm.createNotificationChannel(channel)
            }

            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            val pendingFlags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            val pending = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags)

            val notification = NotificationCompat.Builder(this, PROTECTION_NOTIFICATION_CHANNEL)
                .setSmallIcon(R.drawable.notification_icon)
                .setContentTitle("NoGoon protection is active")
                .setContentText("Blocking is running in the background.")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setSilent(true)
                .setContentIntent(pending)
                .build()

            startForeground(PROTECTION_NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            // Never let a notification/foreground-service failure take the
            // accessibility service down with it — blocking must keep working
            // even if the OS refuses the foreground promotion for some reason.
            Log.e(TAG, "Failed to start protection foreground notification", e)
        }
    }

    // ── Main event handler ────────────────────────────────────────────────────

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        // Guard: some OEMs fire events before onServiceConnected completes
        if (!::prefs.isInitialized) return

        // Quick-pause via QS tile — skip all blocking while pause timer is active.
        // Exception: a focus session overrides the pause so the hard-lock can't be bypassed.
        val now = System.currentTimeMillis()
        val isFocusSession = prefs.getLong(KEY_FOCUS_SESSION_END, 0L) > now
        // Curfew, like a focus session, can't be paused away.
        if (!isFocusSession && !isWithinCurfew() && prefs.getLong(KEY_PAUSED_UNTIL, 0L) > now) return

        val hasBlockedApps    = activeBlockedApps().isNotEmpty()
        val hasBlockedDomains = activeBlockedDomains().isNotEmpty()
        // Curfew is checked independently — it can fire even when blocklists are empty.
        val curfewActive      = isWithinCurfew()

        if (!hasBlockedApps && !hasBlockedDomains && !curfewActive) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED   -> handleAppSwitch(event, curfewActive)
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                syncForegroundFromContentEvent(event, curfewActive)
                if (hasBlockedDomains) handleBrowserUrl(event)
            }
            AccessibilityEvent.TYPE_VIEW_SCROLLED          -> {
                syncForegroundFromContentEvent(event, curfewActive)
                if (hasBlockedApps || hasBlockedDomains) handleScrollEvent(event)
            }
        }
    }

    // ── Missed app switches (Samsung Recents / open-apps screen) ───────────────
    // Blocking trusts TYPE_WINDOW_STATE_CHANGED to say "a different app is now in front".
    // Samsung's Recents screen, split-screen, pop-up view and edge panels do not always
    // send one when you tap an app card, so a blocked app could come back to the front
    // with no switch ever seen (the tracker still said it was in front) and no gate.
    //
    // A content or scroll event from a package that is NOT the tracked foreground app,
    // while that same package really is the active window, can only mean the app has
    // come to the front. Treat it as the switch we missed. Events from keyboards, the
    // notification shade and overlays are ignored because the active window is not theirs.
    // Rate-limited per package so a chatty background app costs almost nothing.
    private val lastSyncCheckMs = mutableMapOf<String, Long>()

    private fun syncForegroundFromContentEvent(event: AccessibilityEvent, curfewActive: Boolean) {
        val pkg = event.packageName?.toString() ?: return
        if (pkg.isBlank() || pkg == currentForegroundPackage) return

        val now = System.currentTimeMillis()
        if (now - (lastSyncCheckMs[pkg] ?: 0L) < 300L) return
        lastSyncCheckMs[pkg] = now

        val root = rootInActiveWindow ?: return
        val activePkg = root.packageName?.toString()
        root.recycle()
        if (activePkg != pkg) return

        handleAppSwitch(event, curfewActive)
    }

    // ── Curfew check ──────────────────────────────────────────────────────────
    // Returns true if the current time of day falls within the configured
    // curfew window.  Handles overnight windows (e.g. 22:00–07:00) correctly.

    private fun isWithinCurfew(): Boolean {
        if (!prefs.getBoolean(KEY_CURFEW_ENABLED, false)) return false
        val startStr = prefs.getString(KEY_CURFEW_START, "22:00") ?: "22:00"
        val endStr   = prefs.getString(KEY_CURFEW_END,   "07:00") ?: "07:00"
        val cal = java.util.Calendar.getInstance()
        val nowMins = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)
        return isWithinTimeWindow(startStr, endStr, nowMins)
    }

    // ── Shared time-window check ──────────────────────────────────────────────
    // "HH:mm" start/end strings vs. minutes-since-midnight, handling windows
    // that wrap past midnight (e.g. 22:00–07:00). Used by curfew above and by
    // Modes schedule resolution below — kept as one function so both stay
    // consistent instead of drifting into two slightly different copies.

    private fun isWithinTimeWindow(startStr: String, endStr: String, nowMins: Int): Boolean {
        return try {
            val (startH, startM) = startStr.split(":").map { it.toInt() }
            val (endH,   endM)   = endStr.split(":").map   { it.toInt() }
            val startMins = startH * 60 + startM
            val endMins   = endH * 60 + endM
            if (startMins == endMins) {
                false // zero-length window never matches
            } else if (startMins < endMins) {
                // Same-day window (e.g. 09:00–17:00)
                nowMins in startMins until endMins
            } else {
                // Overnight window (e.g. 22:00–07:00): wraps past midnight
                nowMins >= startMins || nowMins < endMins
            }
        } catch (_: Exception) {
            false
        }
    }

    // ── Modes / Presets resolution ────────────────────────────────────────────
    // KEY_MODES_JSON holds a JSON array written by AppBlockerModule.setModesConfig():
    //   [{ "id": "...", "apps": [...], "domains": [...],
    //      "schedule": { "enabled": true, "days": [1,2,3,4,5], "start": "09:00", "end": "17:00" } }, ...]
    //
    // Exactly one mode is "active" at any moment:
    //   1. The first mode (array order) whose schedule matches today + now wins.
    //   2. Otherwise, the mode whose id matches KEY_ACTIVE_MODE_ID (the user's
    //      manually-selected "current" mode) wins.
    //   3. Otherwise null — the caller falls back to the legacy flat
    //      blockedPackages/blockedDomains lists, i.e. today's behavior for
    //      anyone who has never touched Modes.
    //
    // Deliberately NOT resolved here: BRICKED / Cold Turkey / curfew — those
    // stay independent of whichever Mode is active (see useModesStore.ts on
    // the JS side for why).

    // Cache the resolved mode briefly — TYPE_VIEW_SCROLLED alone can fire
    // hundreds of times a second, and this is called from the top of
    // onAccessibilityEvent on every single event when Modes are configured.
    // A schedule can only flip at whole-minute boundaries anyway, so
    // re-parsing the JSON at most once per MODE_CACHE_MS is free of any real
    // correctness cost while keeping the hot path cheap.
    private var modeCacheAtMs: Long = 0L
    private var modeCacheResult: org.json.JSONObject? = null
    private val MODE_CACHE_MS = 2_000L

    private fun resolveActiveModeJson(): org.json.JSONObject? {
        val now = System.currentTimeMillis()
        if (now - modeCacheAtMs < MODE_CACHE_MS) return modeCacheResult
        modeCacheAtMs = now
        modeCacheResult = computeActiveModeJson()
        return modeCacheResult
    }

    private fun computeActiveModeJson(): org.json.JSONObject? {
        val json = prefs.getString(KEY_MODES_JSON, null)
        if (json.isNullOrBlank()) return null
        val modes = try { org.json.JSONArray(json) } catch (_: Exception) { return null }
        if (modes.length() == 0) return null

        val cal = java.util.Calendar.getInstance()
        // Calendar.DAY_OF_WEEK is 1=Sunday..7=Saturday; JS getDay() is 0=Sunday..6=Saturday.
        val nowDow  = cal.get(java.util.Calendar.DAY_OF_WEEK) - 1
        val nowMins = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)

        for (i in 0 until modes.length()) {
            val mode = modes.optJSONObject(i) ?: continue
            val schedule = mode.optJSONObject("schedule") ?: continue
            if (!schedule.optBoolean("enabled", false)) continue
            val days = schedule.optJSONArray("days")
            val dayMatches = days == null || days.length() == 0 ||
                (0 until days.length()).any { days.optInt(it, -1) == nowDow }
            if (!dayMatches) continue
            if (isWithinTimeWindow(schedule.optString("start", "00:00"), schedule.optString("end", "23:59"), nowMins)) {
                return mode
            }
        }

        val activeId = prefs.getString(KEY_ACTIVE_MODE_ID, null)
        if (!activeId.isNullOrBlank()) {
            for (i in 0 until modes.length()) {
                val mode = modes.optJSONObject(i) ?: continue
                if (mode.optString("id") == activeId) return mode
            }
        }
        return null
    }

    private fun jsonArrayToStringSet(arr: org.json.JSONArray?): Set<String> {
        if (arr == null) return emptySet()
        val out = mutableSetOf<String>()
        for (i in 0 until arr.length()) arr.optString(i)?.let { if (it.isNotBlank()) out.add(it) }
        return out
    }

    // The two lookups every blocking check should go through instead of
    // reading KEY_BLOCKLIST / KEY_DOMAIN_BLOCKLIST directly — resolves to the
    // active Mode's lists when Modes are configured and one currently applies,
    // otherwise falls back unchanged to the legacy flat lists.

    // A Mode that lists nothing at all (e.g. one just created) must not switch blocking
    // off — fall back to the flat lists, same as the JS side (useNativeSync) does.
    private fun modeHasLists(mode: org.json.JSONObject): Boolean =
        (mode.optJSONArray("apps")?.length() ?: 0) > 0 || (mode.optJSONArray("domains")?.length() ?: 0) > 0

    private fun activeBlockedApps(): Set<String> {
        val mode = resolveActiveModeJson()
        if (mode != null && modeHasLists(mode)) return jsonArrayToStringSet(mode.optJSONArray("apps"))
        return prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()
    }

    private fun activeBlockedDomains(): Set<String> {
        val mode = resolveActiveModeJson()
        if (mode != null && modeHasLists(mode)) return jsonArrayToStringSet(mode.optJSONArray("domains"))
        return prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet()) ?: emptySet()
    }

    // ── App blocking ──────────────────────────────────────────────────────────
    // Called on TYPE_WINDOW_STATE_CHANGED, which fires for app switches AND for
    // in-app dialogs, permission prompts, bottom sheets, etc.
    //
    // currentForegroundPackage is updated BEFORE the neverBlock check so that
    // launcher and system packages update the tracker too. Without this, going
    // Home then back to a blocked app would look like a duplicate event and the
    // gate would silently skip.
    //
    // BROWSER SPECIAL CASE: When a browser comes to the foreground, we
    // immediately walk the accessibility tree to check the active URL. This
    // catches the case where the user switches to an already-open tab on a
    // blocked site — such tabs don't fire TYPE_WINDOW_CONTENT_CHANGED because
    // the page content isn't changing, so the normal URL debounce path misses them.

    private fun handleAppSwitch(event: AccessibilityEvent, curfewActive: Boolean = false) {
        val packageName = event.packageName?.toString() ?: return
        if (packageName.isBlank()) return

        // Always update the foreground tracker — including for launchers/system apps.
        // This ensures returning to a blocked app after pressing Home is correctly
        // detected as a new switch rather than skipped as a "duplicate" event.
        val isNewForeground = packageName != currentForegroundPackage

        // ── Unlock-time tracking: record exit ─────────────────────────────────
        // When foreground switches away from a tracked (unlocked) target, compute
        // how long the user spent there and accumulate it in today's total.
        if (isNewForeground) {
            val prev = currentForegroundPackage
            val entryMs = unlockEntryMs.remove(prev)
            if (entryMs != null) {
                val duration = System.currentTimeMillis() - entryMs
                if (duration > 0L) accumulateUnlockTime(duration)
            }
        }

        currentForegroundPackage = packageName

        // ── Curfew enforcement ────────────────────────────────────────────────
        // MUST run before the browser early-return and neverBlock check:
        // during curfew the entire browser is blocked (not just specific URLs),
        // so browsers must not be exempt here.
        // curfewNeverBlock excludes browsers; neverBlock includes them.
        if (curfewActive && isNewForeground &&
                curfewNeverBlock.none { packageName.startsWith(it) }) {
            triggerCurfewIfNotOnCooldown(packageName)
            return
        }

        // Browsers: any window event forgets what we last saw, so the page is judged
        // again. On a new foreground we check at once. When it is the SAME browser
        // (the tab switcher closing, another tab picked, a menu or sheet dismissed) the
        // address bar usually hasn't updated yet and may not fire another content event
        // at all, so look again shortly after. Before this, going back into a blocked
        // site through the tab switcher matched the cached domain and was let straight in.
        if (browserPackages.contains(packageName)) {
            lastSeenUrl.remove(packageName)
            lastBrowserCheckMs.remove(packageName)
            if (isNewForeground) {
                checkBrowserUrlNow(packageName)
            } else {
                scheduleBrowserRecheck(packageName)
            }
            return
        }

        if (neverBlock.any { packageName.startsWith(it) }) return
        if (!isNewForeground) return   // in-app dialog/popup within blocked app

        // ── Regular blocklist enforcement ─────────────────────────────────────
        val blockedSet = activeBlockedApps()
        if (!blockedSet.contains(packageName)) return

        // ── Unlock-time tracking: record entry ────────────────────────────────
        // If the target is blocked but temporarily unlocked (user played a game),
        // record when they entered instead of re-triggering the gate.
        if (isTemporarilyUnlocked(packageName)) {
            unlockEntryMs[packageName] = System.currentTimeMillis()
            return
        }

        triggerIfNotOnCooldown(packageName, source = "app")
    }

    // ── Immediate browser URL check ────────────────────────────────────────────
    // Called when a browser comes to the foreground. Reads the URL directly from
    // the accessibility tree without waiting for a content-change event.
    // Used to catch already-open tabs on blocked domains.

    private fun scheduleBrowserRecheck(packageName: String) {
        for (delayMs in longArrayOf(350L, 1_100L)) {
            mainHandler.postDelayed({
                if (currentForegroundPackage == packageName) checkBrowserUrlNow(packageName)
            }, delayMs)
        }
    }

    private fun checkBrowserUrlNow(packageName: String) {
        val hasBlockedDomains = activeBlockedDomains().isNotEmpty()
        if (!hasBlockedDomains) return

        val rootNode = rootInActiveWindow ?: return
        val url = findUrlInNodeTree(rootNode)
        rootNode.recycle()
        if (url == null) return

        val domain = extractDomain(url)
        if (domain.isBlank() || !domain.contains('.')) return

        // Update the cache so the next content-change event skips re-checking
        // the same domain unless it actually changes.
        lastSeenUrl[packageName] = domain
        lastBrowserCheckMs[packageName] = System.currentTimeMillis()

        val blockedDomains = activeBlockedDomains()
        val isBlocked = blockedDomains.any { blocked ->
            domain == blocked || domain.endsWith(".$blocked")
        }
        if (!isBlocked) return

        triggerIfNotOnCooldown(domain, source = "web")
    }

    // ── Web / browser blocking ────────────────────────────────────────────────
    // TYPE_WINDOW_CONTENT_CHANGED fires on every text change — potentially hundreds
    // of times per second on a dynamic page. Two short-circuit layers prevent
    // expensive work on the vast majority of these events:
    //
    //   Layer 1 — Time debounce: skip entirely if we checked this browser <500ms ago.
    //   Layer 2 — URL cache: skip blocklist lookup if the domain hasn't changed.
    //
    // Only on a new domain do we hit getStringSet() and the blocking logic.

    private fun handleBrowserUrl(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return
        if (!browserPackages.contains(packageName)) return

        // Layer 1: time-based debounce — skip tree walk if too recent
        val now = System.currentTimeMillis()
        val lastCheck = lastBrowserCheckMs[packageName] ?: 0L
        if (now - lastCheck < URL_DEBOUNCE_MS) return
        lastBrowserCheckMs[packageName] = now

        // Expensive: traverse the accessibility node tree to find the address bar
        val rootNode = rootInActiveWindow ?: return
        val url = findUrlInNodeTree(rootNode)
        rootNode.recycle()          // always recycle even if url is null — prevents memory leak
        if (url == null) {
            // No address bar on screen (tab switcher, new-tab page, toolbar hidden). Forget the
            // cached domain, otherwise coming back to the SAME blocked site compares equal to it
            // and skips the check.
            lastSeenUrl.remove(packageName)
            return
        }

        val domain = extractDomain(url)
        if (domain.isBlank() || !domain.contains('.')) return

        // Layer 2: URL domain cache — skip blocklist lookup if we're still on the same page
        val prevDomain = lastSeenUrl[packageName]
        lastSeenUrl[packageName] = domain
        if (prevDomain == domain) return

        val blockedDomains = activeBlockedDomains()
        val isBlocked = blockedDomains.any { blocked ->
            domain == blocked || domain.endsWith(".$blocked")
        }
        if (!isBlocked) return

        triggerIfNotOnCooldown(domain, source = "web")
    }

    // ── Scroll / doom-scroll detection ────────────────────────────────────────
    // TYPE_VIEW_SCROLLED fires on every frame while the user scrolls — potentially
    // hundreds of events per second.  We use a 2s debounce (per package) to keep
    // the hot path cheap, then track a per-target "scroll session" duration.
    // After SCROLL_GATE_TRIGGER_MS of uninterrupted scrolling on a blocked target
    // a lightweight "scroll check-in" gate is fired at most once per 5 minutes.
    //
    // A 30-second idle gap (no scroll events) is treated as the end of the session,
    // so brief pauses (reading a comment, watching an embedded video) don't reset
    // the timer unfairly.

    private fun handleScrollEvent(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return
        if (packageName.isBlank()) return

        // 2s debounce per package — TYPE_VIEW_SCROLLED fires on every frame
        val now = System.currentTimeMillis()
        val lastCheck = scrollDebounceMs[packageName] ?: 0L
        if (now - lastCheck < SCROLL_CHECK_DEBOUNCE_MS) return
        scrollDebounceMs[packageName] = now

        // Determine the blocking target for this scroll event.
        val target: String
        if (browserPackages.contains(packageName)) {
            val domain = lastSeenUrl[packageName] ?: return
            val blockedDomains = activeBlockedDomains()
            val isBlocked = blockedDomains.any { blocked ->
                domain == blocked || domain.endsWith(".$blocked")
            }
            if (!isBlocked) return
            if (isTemporarilyUnlocked(domain)) return
            target = domain
        } else {
            val blockedSet = activeBlockedApps()
            if (!blockedSet.contains(packageName)) return
            if (isTemporarilyUnlocked(packageName)) return
            target = packageName
        }

        // Idle reset: gap > 30s means the user stopped scrolling — start fresh.
        val lastScroll = lastScrollEventMs[target] ?: 0L
        if (now - lastScroll > SCROLL_IDLE_RESET_MS) {
            scrollSessionStartMs[target] = now
        }
        lastScrollEventMs[target] = now

        // Haven't been scrolling long enough yet.
        val sessionStart = scrollSessionStartMs.getOrPut(target) { now }
        if (now - sessionStart < SCROLL_GATE_TRIGGER_MS) return

        // Scroll-gate cooldown (separate from the normal 3s per-target cooldown).
        val scrollCoolKey = "$KEY_SCROLL_COOLDOWN_PREFIX$target"
        val lastScrollGate = prefs.getLong(scrollCoolKey, 0L)
        if (now - lastScrollGate < SCROLL_GATE_COOLDOWN_MS) return

        // Trigger! Reset the session clock and fire the scroll check-in.
        prefs.edit().putLong(scrollCoolKey, now).apply()
        scrollSessionStartMs[target] = now   // prevent immediate re-trigger after dismiss

        launchNoGoon(target, source = "scroll", rapid = false, rapidCount = 0)
    }

    // ── Curfew gate trigger ───────────────────────────────────────────────────
    // Same 3s cooldown as normal blocking to prevent repeated fires from in-app
    // events while the gate is already on screen.  Uses a shared "curfew" key
    // per package so rapid returns during curfew don't stack into lockout.

    private fun triggerCurfewIfNotOnCooldown(packageName: String) {
        val now = System.currentTimeMillis()
        val cooldownKey = "${KEY_COOLDOWN_PREFIX}curfew_$packageName"
        val lastTrigger = prefs.getLong(cooldownKey, 0L)
        if (now - lastTrigger < COOLDOWN_MS) return
        // If the launch debounce is going to swallow this event, bail BEFORE stamping the
        // cooldown — otherwise the stamp makes the next real attempt look "on cooldown".
        if (now - lastGateLaunchMs < GATE_LAUNCH_DEBOUNCE_MS) return
        prefs.edit().putLong(cooldownKey, now).apply()
        // Launch gate with curfew=1 so gate.tsx jumps straight to curfew phase
        val now2 = System.currentTimeMillis()
        if (now2 - lastGateLaunchMs < GATE_LAUNCH_DEBOUNCE_MS) return
        lastGateLaunchMs = now2
        showGrayscaleOverlay()
        try {
            val uri = Uri.parse(
                "nogoon://gate?domain=${Uri.encode(packageName)}&source=curfew&curfew=1"
            )
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK  or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }
            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "triggerCurfewIfNotOnCooldown failed for $packageName", e)
        }
    }

    // ── Unlock-time accumulator ────────────────────────────────────────────────
    // Adds `durationMs` to today's running total of time spent in unlocked apps.
    // Written to SharedPreferences under key "unlock_time_YYYY-MM-DD".
    // JS reads this via AppBlockerModule.getUnlockTimeLog() on app resume.

    private fun accumulateUnlockTime(durationMs: Long) {
        val dateKey = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            .format(java.util.Date())
        val prefKey = "$KEY_UNLOCK_TIME_PREFIX$dateKey"
        val existing = prefs.getLong(prefKey, 0L)
        prefs.edit().putLong(prefKey, existing + durationMs).apply()
        Log.d(TAG, "Unlock time +${durationMs}ms → today total ${existing + durationMs}ms")
    }

    // ── Temporary unlock check ────────────────────────────────────────────────
    // After a user plays a game and taps unlock, JS writes an expiry timestamp
    // to SharedPreferences under "unlock_{domain}". We check it here before
    // every intercept. Expired entries are cleaned up immediately.

    private fun isTemporarilyUnlocked(target: String): Boolean {
        val host = target.trim().lowercase()
        if (host.isEmpty()) return false
        val now = System.currentTimeMillis()

        // An unlock covers the whole site: the host itself, any parent domain
        // (unlock for instagram.com covers m.instagram.com) and any subdomain
        // (unlock for m.instagram.com covers instagram.com).
        val candidates = ArrayList<String>()
        candidates.add(host)
        if (host.contains('.')) {
            var rest = host
            while (rest.contains('.')) {
                rest = rest.substringAfter('.')
                if (rest.contains('.')) candidates.add(rest)   // never match a bare TLD
            }
            for (k in prefs.all.keys) {
                if (k.startsWith("unlock_") && !k.startsWith("unlock_time_")) {
                    val d = k.removePrefix("unlock_")
                    if (d.endsWith(".$host")) candidates.add(d)
                }
            }
        }

        var unlocked = false
        for (c in candidates) {
            val key = "unlock_$c"
            val expiryMs = prefs.getLong(key, 0L)
            if (expiryMs == 0L) continue
            if (now < expiryMs) unlocked = true
            else prefs.edit().remove(key).apply()    // expired — clean up
        }
        return unlocked
    }

    // ── Cooldown check + trigger ──────────────────────────────────────────────
    // Cooldown timestamps are stored in SharedPreferences (prefixed "cooldown_")
    // so the 3s window survives Android killing and restarting this service.
    // All reads hit the in-memory prefs cache — no disk I/O in steady state.

    private fun triggerIfNotOnCooldown(target: String, source: String) {
        if (isTemporarilyUnlocked(target)) return

        val now = System.currentTimeMillis()
        val cooldownKey = "$KEY_COOLDOWN_PREFIX$target"
        val lastTrigger = prefs.getLong(cooldownKey, 0L)
        if (now - lastTrigger < COOLDOWN_MS) return
        // Don't stamp the cooldown / rapid counters for an event launchNoGoon() will drop
        // because of the service-level debounce — that would make the user's next genuine
        // attempt look "on cooldown" and open the app with no gate.
        if (now - lastGateLaunchMs < GATE_LAUNCH_DEBOUNCE_MS) return

        // Rapid-return lockout: for 10 minutes every attempt is still gated (with the
        // "breather" screen). It used to push the cooldown key 10 minutes out, which made
        // the service silently ignore the app — i.e. a 10-minute FREE PASS.
        val lockoutKey = "$KEY_LOCKOUT_UNTIL_PREFIX$target"
        if (prefs.getLong(lockoutKey, 0L) > now) {
            prefs.edit().putLong(cooldownKey, now).apply()
            launchNoGoon(target, source, true, RAPID_LOCKOUT_COUNT)
            return
        }

        // ── Rapid re-entry detection ──────────────────────────────────────────
        // Tracks how many times the user returns to a blocked target within the
        // 3-minute window after the gate last fired.  After RAPID_LOCKOUT_COUNT
        // rapid returns the cooldown key is pushed 10 minutes into the future so
        // the gate won't re-fire during that window.

        val rapidLastKey  = "$KEY_RAPID_LAST_MS_PREFIX$target"
        val rapidCountKey = "$KEY_RAPID_COUNT_PREFIX$target"
        val lastShownMs   = prefs.getLong(rapidLastKey, 0L)
        val isRapid       = lastShownMs > 0L && (now - lastShownMs) < RAPID_WINDOW_MS
        val rapidCount    = if (isRapid) prefs.getInt(rapidCountKey, 0) + 1 else 0

        val editor = prefs.edit()
            .putLong(cooldownKey, now)
            .putLong(rapidLastKey, now)
            .putInt(rapidCountKey, rapidCount)

        // After enough rapid returns, start a 10-minute lockout (checked above).
        if (isRapid && rapidCount >= RAPID_LOCKOUT_COUNT) {
            editor.putLong(lockoutKey, now + RAPID_LOCKOUT_MS)
        }
        editor.apply()

        launchNoGoon(target, source, isRapid, rapidCount)
    }

    // ── Launch NoGoon intercept screen ────────────────────────────────────────
    // FLAG_ACTIVITY_SINGLE_TOP prevents stacked gate screens if the service fires
    // twice in quick succession (e.g., during a service restart race condition).
    //
    // A service-level debounce (GATE_LAUNCH_DEBOUNCE_MS) is applied BEFORE the
    // startActivity call so that rapid events (e.g., WINDOW_STATE_CHANGED and
    // WINDOW_CONTENT_CHANGED firing within milliseconds) don't both land before
    // the gate Activity has finished initializing.  The per-target 3s cooldown
    // in triggerIfNotOnCooldown already prevents most duplicates, but this is a
    // final safety net for cross-target races and the browser-foreground fast path.

    // ── Grayscale overlay ────────────────────────────────────────────────────
    // Shown briefly over the blocked content before the gate launches.
    // TYPE_ACCESSIBILITY_OVERLAY sits above all app windows; no SYSTEM_ALERT_WINDOW
    // permission needed — the accessibility service grant covers it.

    private fun showGrayscaleOverlay() {
        if (!prefs.getBoolean(KEY_GRAYSCALE_ENABLED, false)) return
        mainHandler.post {
            removeGrayscaleOverlayLocked()
            try {
                val wm = getSystemService(WINDOW_SERVICE) as WindowManager
                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                )
                val view = View(this)
                // Dark desaturating tint — creates immediate visual friction over
                // the blocked content and signals that NoGoon is stepping in.
                view.setBackgroundColor(Color.argb(210, 8, 8, 12))
                wm.addView(view, params)
                grayscaleOverlay = view
                // Auto-dismiss after gate has had time to appear
                mainHandler.postDelayed({ removeGrayscaleOverlayLocked() }, OVERLAY_DISMISS_MS)
            } catch (e: Exception) {
                Log.w(TAG, "Could not show grayscale overlay", e)
            }
        }
    }

    private fun removeGrayscaleOverlayLocked() {
        grayscaleOverlay?.let { view ->
            try {
                (getSystemService(WINDOW_SERVICE) as WindowManager).removeViewImmediate(view)
            } catch (e: Exception) {
                Log.w(TAG, "Overlay already removed", e)
            }
            grayscaleOverlay = null
        }
    }

    private fun launchNoGoon(target: String, source: String, rapid: Boolean = false, rapidCount: Int = 0) {
        val now = System.currentTimeMillis()
        if (now - lastGateLaunchMs < GATE_LAUNCH_DEBOUNCE_MS) {
            Log.d(TAG, "Skipping gate launch — debounce active (${now - lastGateLaunchMs}ms since last)")
            return
        }
        lastGateLaunchMs = now
        showGrayscaleOverlay()  // dim screen immediately before gate appears
        try {
            val rapidParams = if (rapid) "&rapid=1&rapidCount=$rapidCount" else ""
            val uri = Uri.parse(
                "nogoon://gate?domain=${Uri.encode(target)}&source=$source$rapidParams"
            )
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK  or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP     // reuse existing gate instance
                )
            }
            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Log failures so intent/deep-link misconfigurations are diagnosable in logcat
            Log.e(TAG, "launchNoGoon failed for target=$target source=$source", e)
        }
    }

    // ── Stale key pruning ─────────────────────────────────────────────────────
    // cooldown_ and unlock_ keys accumulate in SharedPreferences over time as
    // users visit many blocked apps and domains. Runs on every onServiceConnected
    // (Android restarts the service periodically) to remove entries that are already
    // expired and will never be read again. Typical run: O(n) key count — cheap.

    private fun pruneExpiredKeys() {
        val now = System.currentTimeMillis()
        val editor = prefs.edit()
        var pruned = 0
        for ((key, value) in prefs.all) {
            if (key.startsWith(KEY_COOLDOWN_PREFIX) && value is Long) {
                if (now - value > COOLDOWN_MS) { editor.remove(key); pruned++ }
            }
            // "unlock_time_<date>" holds accumulated milliseconds for Insights, NOT an expiry
            // timestamp — pruning it as one deleted the whole log on every service reconnect.
            if (key.startsWith("unlock_") && !key.startsWith(KEY_UNLOCK_TIME_PREFIX) && value is Long) {
                if (now > value) { editor.remove(key); pruned++ }
            }
            if (key.startsWith(KEY_LOCKOUT_UNTIL_PREFIX) && value is Long) {
                if (now > value) { editor.remove(key); pruned++ }
            }
            // Rapid re-entry tracking keys: prune after 1 hour of inactivity
            if (key.startsWith(KEY_RAPID_LAST_MS_PREFIX) && value is Long) {
                if (now - value > 60L * 60 * 1000) { editor.remove(key); pruned++ }
            }
            if (key.startsWith(KEY_RAPID_COUNT_PREFIX) && value is Int) {
                val companion = key.replace(KEY_RAPID_COUNT_PREFIX, KEY_RAPID_LAST_MS_PREFIX)
                val lastMs = prefs.getLong(companion, 0L)
                if (now - lastMs > RAPID_WINDOW_MS) { editor.remove(key); pruned++ }
            }
            // Scroll gate cooldown keys: prune after the 5-minute cooldown expires
            if (key.startsWith(KEY_SCROLL_COOLDOWN_PREFIX) && value is Long) {
                if (now - value > SCROLL_GATE_COOLDOWN_MS) { editor.remove(key); pruned++ }
            }
            // Unlock time keys: prune entries older than 8 days
            if (key.startsWith(KEY_UNLOCK_TIME_PREFIX) && value is Long) {
                val datePart = key.removePrefix(KEY_UNLOCK_TIME_PREFIX)
                try {
                    val entryDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                        .parse(datePart)
                    if (entryDate != null && now - entryDate.time > 8L * 24 * 60 * 60 * 1000) {
                        editor.remove(key); pruned++
                    }
                } catch (_: Exception) { /* malformed key — ignore */ }
            }
        }
        if (pruned > 0) editor.apply()
    }

    // ── URL bar finder ────────────────────────────────────────────────────────
    // Strategy 1: known view IDs per browser (fast, O(1) per browser).
    // Strategy 2: full recursive text scan (fallback for unknown browsers).

    private fun findUrlInNodeTree(rootNode: AccessibilityNodeInfo): String? {
        val urlBarIds = listOf(
            "com.android.chrome:id/url_bar",
            "com.android.chrome:id/search_box_text",
            "org.mozilla.firefox:id/url_bar_title",
            "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
            "com.brave.browser:id/url_bar",
            "com.microsoft.emmx:id/url_bar",
            "com.opera.browser:id/url_field",
            "com.sec.android.app.sbrowser:id/location_bar_edit_text",
        )

        for (viewId in urlBarIds) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(viewId)
            if (nodes != null && nodes.isNotEmpty()) {
                val text = nodes[0].text?.toString()
                nodes.forEach { it.recycle() }
                if (!text.isNullOrBlank()) return text
            }
        }

        return findUrlByTextScan(rootNode)
    }

    // Recursive tree walk — fallback for browsers without a known view ID.
    // Depth-limited to 12 levels to prevent StackOverflowError on pathologically
    // deep accessibility trees (seen on some custom OEM browsers and WebView apps).
    private fun findUrlByTextScan(node: AccessibilityNodeInfo, depth: Int = 0): String? {
        if (depth > 12) return null
        val text = node.text?.toString()
        if (text != null && (text.startsWith("http") || looksLikeDomain(text))) {
            return text
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findUrlByTextScan(child, depth + 1)
            child.recycle()
            if (result != null) return result
        }
        return null
    }

    // Quick heuristic — does this text look like a domain or URL?
    private fun looksLikeDomain(text: String): Boolean {
        if (text.length > 200) return false
        return text.matches(Regex("^[a-zA-Z0-9][a-zA-Z0-9\\-\\.]+\\.[a-zA-Z]{2,}(/.*)?$"))
    }

    // ── Domain extractor ──────────────────────────────────────────────────────
    // "https://www.tiktok.com/feed" → "tiktok.com"
    // Subdomain matching (m.facebook.com → matches facebook.com) is handled in
    // the blocklist check via endsWith(".$blocked"), not by stripping here.

    private fun extractDomain(rawUrl: String): String {
        return rawUrl
            .removePrefix("https://")
            .removePrefix("http://")
            .removePrefix("www.")
            .split("/")[0]
            .split("?")[0]
            .split("#")[0]
            .trim()
            .lowercase()
    }

    override fun onInterrupt() {
        // Clear in-memory debounce caches so a fresh service connection starts clean
        lastBrowserCheckMs.clear()
        lastSeenUrl.clear()
        scrollSessionStartMs.clear()
        lastScrollEventMs.clear()
        scrollDebounceMs.clear()
        unlockEntryMs.clear()
        currentForegroundPackage = ""
        lastGateLaunchMs = 0L
        mainHandler.post { removeGrayscaleOverlayLocked() }
    }
}
