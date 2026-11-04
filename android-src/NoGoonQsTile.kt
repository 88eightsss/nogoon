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
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log

@TargetApi(Build.VERSION_CODES.N)
class NoGoonQsTile : TileService() {

    companion object {
        const val PREFS_NAME       = "NoGoonBlocker"
        const val KEY_PAUSED_UNTIL = "blockingPausedUntil"
        // How long a single pause lasts. Was 30 minutes with one tap and no friction, which made this
        // tile the easiest way around the blocker. It is now 10 minutes, and starting a pause opens a
        // short pause screen in the app (a 10 second wait and a "keep blocking" button first). Hard
        // Mode and Cold Turkey refuse the pause there.
        private const val PAUSE_DURATION_MS = 10 * 60 * 1000L
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
        if (isPaused) {
            // Turning blocking back ON needs no friction.
            prefs.edit().putLong(KEY_PAUSED_UNTIL, 0L).apply()
            Log.d(TAG, "QS tile toggled — blocking resumed")
            updateTile()
            return
        }
        // Pausing: open the pause screen instead of switching blocking off right here.
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("nogoon://pause")).apply {
                setPackage(packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (Build.VERSION.SDK_INT >= 34) {
                val pending = PendingIntent.getActivity(
                    this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                startActivityAndCollapse(pending)
            } else {
                @Suppress("DEPRECATION")
                startActivityAndCollapse(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Could not open the pause screen — leaving blocking on", e)
        }
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
