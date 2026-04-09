// ═══════════════════════════════════════════════════════════════════════════
//  NoGoon Accessibility Service
//  ─────────────────────────────
//  Background Android service that watches both:
//
//    1. APP BLOCKING  — detects when a blocked app opens (Instagram, TikTok, etc.)
//    2. WEB BLOCKING  — detects when Chrome/Firefox navigates to a blocked domain
//
//  HOW APP BLOCKING WORKS:
//    TYPE_WINDOW_STATE_CHANGED fires whenever the user switches apps.
//    We check the incoming package name against the blocked apps list.
//
//  HOW WEB BLOCKING WORKS:
//    TYPE_WINDOW_CONTENT_CHANGED fires whenever any text on screen changes.
//    When it comes from a browser, we read the address bar text, extract
//    the domain, and check it against the blocked website list.
//    This works in Chrome, Firefox, Edge, Brave, and Opera.
// ═══════════════════════════════════════════════════════════════════════════

package com.nogoon.app

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class NoGoonAccessibilityService : AccessibilityService() {

    companion object {
        const val PREFS_NAME          = "NoGoonBlocker"
        const val KEY_BLOCKLIST       = "blockedPackages"   // app package names
        const val KEY_DOMAIN_BLOCKLIST = "blockedDomains"   // website domains
        const val KEY_ENABLED         = "serviceActive"
        const val COOLDOWN_MS         = 3_000L              // 3s between triggers
    }

    private val recentlyTriggered = mutableMapOf<String, Long>()

    // ── Packages that are NEVER blocked ───────────────────────────────────────
    // System essentials, launchers, NoGoon itself, and all browsers.
    // Browsers are excluded from APP blocking but handled separately via URL detection.

    private val neverBlock = setOf(
        "com.nogoon.app",
        "com.android.launcher", "com.android.launcher2", "com.android.launcher3",
        "com.google.android.apps.nexuslauncher",
        "com.miui.home", "com.huawei.android.launcher",
        "com.sec.android.app.launcher", "com.oppo.launcher",
        "com.realme.launcher", "com.oneplus.launcher",
        "com.android.systemui", "com.android.settings", "android",
        "com.android.phone", "com.android.dialer", "com.google.android.dialer",
        // Browsers — these are handled by URL detection, not package blocking
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

    // ── Main event handler ────────────────────────────────────────────────────

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ENABLED, false)) return

        when (event.eventType) {
            // App switch — check package name against blocked apps
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> handleAppSwitch(event, prefs)

            // Content changed — check browser URL against blocked domains
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> handleBrowserUrl(event, prefs)
        }
    }

    // ── App blocking ──────────────────────────────────────────────────────────
    // Called every time the user switches to a different app.
    // Checks the package name against the blocked apps list.

    private fun handleAppSwitch(event: AccessibilityEvent, prefs: SharedPreferences) {
        val packageName = event.packageName?.toString() ?: return
        if (packageName.isBlank()) return
        if (neverBlock.any { packageName.startsWith(it) }) return

        val blockedSet = prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()
        if (!blockedSet.contains(packageName)) return

        triggerIfNotOnCooldown(packageName, source = "app")
    }

    // ── Web / browser blocking ────────────────────────────────────────────────
    // Called whenever content on screen changes. We only care about browsers.
    // Reads the address bar text and checks against blocked domains.

    private fun handleBrowserUrl(event: AccessibilityEvent, prefs: SharedPreferences) {
        val packageName = event.packageName?.toString() ?: return
        if (!browserPackages.contains(packageName)) return

        // Get the root accessibility node tree for the current window
        val rootNode = rootInActiveWindow ?: return

        // Walk the node tree to find the URL bar
        val url = findUrlInNodeTree(rootNode) ?: return
        rootNode.recycle()

        // Extract just the domain from the URL (strip https://, www., and paths)
        val domain = extractDomain(url)
        if (domain.isBlank() || !domain.contains('.')) return

        // Check if this domain (or a parent domain) is on the blocked list
        val blockedDomains = prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet()) ?: emptySet()
        val isBlocked = blockedDomains.any { blocked ->
            domain == blocked || domain.endsWith(".$blocked")
        }
        if (!isBlocked) return

        triggerIfNotOnCooldown(domain, source = "web")
    }

    // ── Cooldown check + trigger ──────────────────────────────────────────────
    // Prevents the intercept from firing more than once every 3 seconds
    // for the same target (app or domain).

    private fun triggerIfNotOnCooldown(target: String, source: String) {
        val now = System.currentTimeMillis()
        val lastTrigger = recentlyTriggered[target] ?: 0L
        if (now - lastTrigger < COOLDOWN_MS) return

        recentlyTriggered[target] = now
        launchNoGoon(target, source)
    }

    // ── Launch NoGoon intercept screen ────────────────────────────────────────

    private fun launchNoGoon(target: String, source: String) {
        try {
            val uri = Uri.parse(
                "nogoon://nogoon?domain=${Uri.encode(target)}&confidence=95&source=$source"
            )
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Silent fail — if NoGoon isn't installed or deep link fails, do nothing
        }
    }

    // ── URL bar finder ────────────────────────────────────────────────────────
    // Walks the accessibility node tree looking for the browser address bar.
    // Different browsers use different view IDs, so we try several approaches.

    private fun findUrlInNodeTree(rootNode: AccessibilityNodeInfo): String? {
        // Strategy 1: Look for nodes with known URL bar resource IDs
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

        // Strategy 2: Walk the whole tree looking for a node that looks like a URL
        return findUrlByTextScan(rootNode)
    }

    // Recursive tree walk — fallback for browsers we don't have a specific ID for.
    // Looks for text nodes that start with "http" or look like a domain name.

    private fun findUrlByTextScan(node: AccessibilityNodeInfo): String? {
        val text = node.text?.toString()
        if (text != null && (text.startsWith("http") || looksLikeDomain(text))) {
            return text
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findUrlByTextScan(child)
            child.recycle()
            if (result != null) return result
        }

        return null
    }

    // Quick heuristic — does this string look like a domain or URL?
    private fun looksLikeDomain(text: String): Boolean {
        if (text.length > 200) return false // Too long to be a URL bar
        return text.matches(Regex("^[a-zA-Z0-9][a-zA-Z0-9\\-\\.]+\\.[a-zA-Z]{2,}(/.*)?$"))
    }

    // ── Domain extractor ──────────────────────────────────────────────────────
    // Strips protocol, www, and paths to get just the bare domain.
    // "https://www.tiktok.com/feed" → "tiktok.com"

    private fun extractDomain(rawUrl: String): String {
        return rawUrl
            .removePrefix("https://")
            .removePrefix("http://")
            .removePrefix("www.")
            .split("/")[0]      // remove path
            .split("?")[0]      // remove query params
            .split("#")[0]      // remove fragment
            .trim()
            .lowercase()
    }

    override fun onInterrupt() { /* Required override — intentionally empty */ }
}
