// ─── NoGoon Quick Settings Tile ──────────────────────────────────────────────
//
// Adds a toggle tile to Android's Quick Settings panel (pull down from top).
// Lets users pause/resume blocking without opening the app.
//
// States:
//   Active (green icon)   — blocking is ON (normal)
//   Inactive (grey icon)  — blocking is PAUSED
//
// The pause expiry is stored in SharedPreferences under "blockingPausedUntil"
// (ms timestamp; 0 = not paused). NoGoonAccessibilityService checks this before every intercept.
// ─────────────────────────────────────────────────────────────────────────────

package com.nogoon.app

import android.annotation.TargetApi
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log

@TargetApi(Build.VERSION_CODES.N)
class NoGoonQsTile : TileService() {

    companion object {
        const val PREFS_NAME       = "NoGoonBlocker"
        const val KEY_PAUSED_UNTIL = "blockingPausedUntil"
        // How long a single QS-tile pause lasts
        private const val PAUSE_DURATION_MS = 30 * 60 * 1000L
        private const val TAG = "NoGoon"
    }

    // Called when the tile becomes visible in the Quick Settings panel.
    override fun onStartListening() {
        super.onStartListening()
        updateTile()
    }

    // Called when the user taps the tile.
    override fun onClick() {
        super.onClick()
        val prefs    = getSharedPreferences(PREFS_NAME, 0)
        val isPaused = prefs.getLong(KEY_PAUSED_UNTIL, 0L) > System.currentTimeMillis()
        val newUntil = if (isPaused) 0L else System.currentTimeMillis() + PAUSE_DURATION_MS
        prefs.edit().putLong(KEY_PAUSED_UNTIL, newUntil).apply()
        Log.d(TAG, "QS tile toggled — blocking paused: ${!isPaused}")
        updateTile()
    }

    private fun updateTile() {
        val tile     = qsTile ?: return
        val prefs    = getSharedPreferences(PREFS_NAME, 0)
        val isPaused = prefs.getLong(KEY_PAUSED_UNTIL, 0L) > System.currentTimeMillis()

        tile.state = if (isPaused) Tile.STATE_INACTIVE else Tile.STATE_ACTIVE
        tile.label = "NoGoon"

        // Subtitle (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = if (isPaused) "Paused" else "Blocking"
        }

        tile.updateTile()
    }
}
