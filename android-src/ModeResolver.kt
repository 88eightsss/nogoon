package com.nogoon.app

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Resolves which blocklists are live right now, for the components that don't have
 * the Accessibility Service's own copy of this logic (the DNS filter and the
 * notification filter). Same rules as the service: a scheduled Mode that matches
 * the current time wins, then the manually selected Mode, then the user's own flat
 * lists. A Mode that lists nothing never switches protection off.
 */
object ModeResolver {
    private const val KEY_BLOCKLIST = "blockedPackages"
    private const val KEY_DOMAIN_BLOCKLIST = "blockedDomains"
    private const val KEY_MODES_JSON = "modes_config_json"
    private const val KEY_ACTIVE_MODE_ID = "active_mode_id"
    private const val CACHE_MS = 5_000L

    @Volatile private var cacheAt = 0L
    @Volatile private var cacheMode: JSONObject? = null

    fun activeApps(prefs: SharedPreferences): Set<String> {
        val mode = resolve(prefs)
        if (mode != null && hasLists(mode)) return toSet(mode.optJSONArray("apps"))
        return prefs.getStringSet(KEY_BLOCKLIST, emptySet()) ?: emptySet()
    }

    fun activeDomains(prefs: SharedPreferences): Set<String> {
        val mode = resolve(prefs)
        if (mode != null && hasLists(mode)) return toSet(mode.optJSONArray("domains"))
        return prefs.getStringSet(KEY_DOMAIN_BLOCKLIST, emptySet()) ?: emptySet()
    }

    private fun hasLists(mode: JSONObject): Boolean =
        (mode.optJSONArray("apps")?.length() ?: 0) > 0 || (mode.optJSONArray("domains")?.length() ?: 0) > 0

    private fun toSet(arr: JSONArray?): Set<String> {
        if (arr == null) return emptySet()
        val out = mutableSetOf<String>()
        for (i in 0 until arr.length()) {
            val v = arr.optString(i)
            if (!v.isNullOrBlank()) out.add(v)
        }
        return out
    }

    private fun resolve(prefs: SharedPreferences): JSONObject? {
        val now = System.currentTimeMillis()
        if (now - cacheAt < CACHE_MS) return cacheMode
        cacheAt = now
        cacheMode = compute(prefs)
        return cacheMode
    }

    private fun compute(prefs: SharedPreferences): JSONObject? {
        val json = prefs.getString(KEY_MODES_JSON, null)
        if (json.isNullOrBlank()) return null
        val modes = try { JSONArray(json) } catch (_: Exception) { return null }
        if (modes.length() == 0) return null

        val cal = java.util.Calendar.getInstance()
        val nowDow = cal.get(java.util.Calendar.DAY_OF_WEEK) - 1
        val nowMins = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)

        for (i in 0 until modes.length()) {
            val mode = modes.optJSONObject(i) ?: continue
            val schedule = mode.optJSONObject("schedule") ?: continue
            if (!schedule.optBoolean("enabled", false)) continue
            val days = schedule.optJSONArray("days")
            val dayMatches = days == null || days.length() == 0 ||
                (0 until days.length()).any { days.optInt(it, -1) == nowDow }
            if (!dayMatches) continue
            if (withinWindow(schedule.optString("start", "00:00"), schedule.optString("end", "23:59"), nowMins)) {
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

    private fun withinWindow(startStr: String, endStr: String, nowMins: Int): Boolean {
        return try {
            val (sh, sm) = startStr.split(":").map { it.toInt() }
            val (eh, em) = endStr.split(":").map { it.toInt() }
            val s = sh * 60 + sm
            val e = eh * 60 + em
            when {
                s == e -> false
                s < e -> nowMins in s until e
                else -> nowMins >= s || nowMins < e
            }
        } catch (_: Exception) {
            false
        }
    }
}
