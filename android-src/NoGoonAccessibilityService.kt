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
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class NoGoonAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG              = "NoGoon"
        const val PREFS_NAME           = "NoGoonBlocker"
        const val KEY_BLOCKLIST        = "blockedPackages"   // app package names
        const val KEY_DOMAIN_BLOCKLIST = "blockedDomains"   // website domains
        const val KEY_ENABLED          = "serviceActive"
        const val COOLDOWN_MS               = 3_000L             // 3s between triggers for same target
        const val URL_DEBOUNCE_MS           = 500L               // min ms between URL tree walks per browser
        private const val KEY_COOLDOWN_PREFIX     = "cooldown_"      // prefix for persisted cooldown keys
        private const val KEY_RAPID_LAST_MS_PREFIX = "rapid_last_ms_" // when gate last fired per target
        private const val KEY_RAPID_COUNT_PREFIX   = "rapid_count_"   // consecutive rapid-return count
        private const val RAPID_WINDOW_MS     = 3L * 60 * 1000  // 3-minute rapid re-entry window
        private const val RAPID_LOCKOUT_COUNT = 5               // trigger lockout after this many rapid returns
        private const val RAPID_LOCKOUT_MS    = 10L * 60 * 1000 // 10-minute hard lockout duration

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
    )

    // ── Known browser packages — URL detection runs for these ─────────────────

    private val browserPackages = setOf(
        "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
        "org.mozilla.firefox", "org.mozilla.firefox_beta",
        "com.brave.browser", "com.microsoft.emmx", "com.opera.browser",
        "com.opera.mini.native", "com.sec.android.app.sbrowser",
    )

    // ── Service lifecycle ─────────────────────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        // Cache the prefs instance once — avoids getSharedPreferences() in the hot event path
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        // Remove accumulated stale keys from prior sessions
        pruneExpiredKeys()
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
        if (!isFocusSession && prefs.getLong(KEY_PAUSED_UNTIL, 0L) > now) return

        val hasBlockedApps    = prefs.getStringSet(KEY_BLOCKLIST, emptySet())?.isNotEmpty() ?: false
        val hasBlockedDomains = prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet())?.isNotEmpty() ?: false
        if (!hasBlockedApps && !hasBlockedDomains) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED   -> handleAppSwitch(event)
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> handleBrowserUrl(event)
            AccessibilityEvent.TYPE_VIEW_SCROLLED          -> handleScrollEvent(event)
        }
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

    private fun handleAppSwitch(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return
        if (packageName.isBlank()) return

        // Always update the foreground tracker — including for launchers/system apps.
        // This ensures returning to a blocked app after pressing Home is correctly
        // detected as a new switch rather than skipped as a "duplicate" event.
        val isNewForeground = packageName != currentForegroundPackage
        currentForegroundPackage = packageName

        // Browsers: on a new foreground event, immediately check the active URL.
        // Clear the URL cache and debounce timer so we re-evaluate even if the
        // domain hasn't changed since the last check.
        if (isNewForeground && browserPackages.contains(packageName)) {
            lastSeenUrl.remove(packageName)
            lastBrowserCheckMs.remove(packageName)
            checkBrowserUrlNow(packageName)
            return
        }

        if (neverBlock.any { packageName.startsWith(it) }) return
        if (!isNewForeground) return   // in-app dialog/popup within blocked app

        val blockedSet = prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()
        if (!blockedSet.contains(packageName)) return

        triggerIfNotOnCooldown(packageName, source = "app")
    }

    // ── Immediate browser URL check ────────────────────────────────────────────
    // Called when a browser comes to the foreground. Reads the URL directly from
    // the accessibility tree without waiting for a content-change event.
    // Used to catch already-open tabs on blocked domains.

    private fun checkBrowserUrlNow(packageName: String) {
        val hasBlockedDomains = prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet())?.isNotEmpty() ?: false
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

        val blockedDomains = prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet()) ?: emptySet()
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
        if (url == null) return

        val domain = extractDomain(url)
        if (domain.isBlank() || !domain.contains('.')) return

        // Layer 2: URL domain cache — skip blocklist lookup if we're still on the same page
        val prevDomain = lastSeenUrl[packageName]
        lastSeenUrl[packageName] = domain
        if (prevDomain == domain) return

        val blockedDomains = prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet()) ?: emptySet()
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
            val blockedDomains = prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet()) ?: emptySet()
            val isBlocked = blockedDomains.any { blocked ->
                domain == blocked || domain.endsWith(".$blocked")
            }
            if (!isBlocked) return
            if (isTemporarilyUnlocked(domain)) return
            target = domain
        } else {
            val blockedSet = prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()
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

    // ── Temporary unlock check ────────────────────────────────────────────────
    // After a user plays a game and taps unlock, JS writes an expiry timestamp
    // to SharedPreferences under "unlock_{domain}". We check it here before
    // every intercept. Expired entries are cleaned up immediately.

    private fun isTemporarilyUnlocked(target: String): Boolean {
        val key = "unlock_${target.trim().lowercase()}"
        val expiryMs = prefs.getLong(key, 0L)
        if (expiryMs == 0L) return false
        val now = System.currentTimeMillis()
        if (now < expiryMs) return true
        prefs.edit().remove(key).apply()    // expired — clean up
        return false
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

        // After enough rapid returns, extend the cooldown to lock out for 10 minutes.
        // Setting cooldownKey to (now + lockout - COOLDOWN_MS) means the next
        // "now2 - lastTrigger < COOLDOWN_MS" check stays true until now + lockout.
        if (isRapid && rapidCount >= RAPID_LOCKOUT_COUNT) {
            editor.putLong(cooldownKey, now + RAPID_LOCKOUT_MS - COOLDOWN_MS)
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
            if (key.startsWith("unlock_") && value is Long) {
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
        currentForegroundPackage = ""
        lastGateLaunchMs = 0L
        mainHandler.post { removeGrayscaleOverlayLocked() }
    }
}
