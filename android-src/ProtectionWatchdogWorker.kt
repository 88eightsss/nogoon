// ─── Protection Watchdog Worker ────────────────────────────────────────────────
//
// A periodic background check that catches protection silently dying even
// when NoGoon hasn't been opened in days. Everything else we've built (the
// in-app banner, the persistent foreground notification) only helps once the
// user opens the app or notices the notification — this is the one piece
// that reaches them without either.
//
// Runs via WorkManager (survives app kills, process death, and device
// reboots — WorkManager re-persists and reschedules its own queue). Every
// run just re-checks whether the Accessibility Service is still enabled and,
// if not, posts a high-priority notification nudging the user to re-enable
// it. If protection is healthy, any previously-shown alert is cleared.
//
// Scheduled from AppBlockerModule's init block (runs once per app launch,
// idempotent via ExistingPeriodicWorkPolicy.KEEP) — not from MainApplication,
// to avoid patching two different MainApplication.kt shapes for something
// this low-stakes.

package com.nogoon.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class ProtectionWatchdogWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    companion object {
        private const val WORK_NAME               = "nogoon_protection_watchdog"
        private const val CHECK_INTERVAL_HOURS     = 6L
        private const val WATCHDOG_CHANNEL         = "nogoon_watchdog_alerts"
        private const val WATCHDOG_NOTIFICATION_ID = 4243

        // Called once per app launch from AppBlockerModule's init block.
        // KEEP means an already-scheduled job is left alone — this call is
        // just "make sure the watchdog is running," not "restart the timer."
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<ProtectionWatchdogWorker>(
                CHECK_INTERVAL_HOURS, TimeUnit.HOURS
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        private fun isAccessibilityServiceEnabled(context: Context): Boolean {
            return try {
                val enabledServices = Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                ) ?: ""
                enabledServices.contains(context.packageName, ignoreCase = true)
            } catch (e: Exception) {
                // If we can't tell, don't cry wolf — assume it's fine rather
                // than firing a false-alarm notification.
                true
            }
        }
    }

    override fun doWork(): Result {
        val context = applicationContext
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return Result.success()

        if (isAccessibilityServiceEnabled(context)) {
            // Healthy — clear any stale "protection is off" alert from a
            // previous check so it doesn't linger after the user fixes it.
            nm.cancel(WATCHDOG_NOTIFICATION_ID)
            return Result.success()
        }

        // Nothing to protect yet (e.g. still in onboarding, before any app/site is picked):
        // "protection is off" would be a false alarm, so stay quiet.
        val prefs = context.getSharedPreferences("NoGoonBlocker", 0)
        val nothingConfigured =
            ModeResolver.activeApps(prefs).isEmpty() &&
            ModeResolver.activeDomains(prefs).isEmpty() &&
            !prefs.getBoolean("curfew_enabled", false)
        if (nothingConfigured) {
            nm.cancel(WATCHDOG_NOTIFICATION_ID)
            return Result.success()
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    WATCHDOG_CHANNEL,
                    "Protection alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Alerts you when NoGoon's blocking has silently stopped running"
                }
                nm.createNotificationChannel(channel)
            }

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pendingFlags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            val pending = PendingIntent.getActivity(context, 0, launchIntent, pendingFlags)

            val notification = NotificationCompat.Builder(context, WATCHDOG_CHANNEL)
                .setSmallIcon(R.drawable.notification_icon)
                .setContentTitle("NoGoon protection is off")
                .setContentText("Blocking stopped running in the background. Tap to turn it back on.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true) // don't re-buzz on every 6h re-check while still unfixed
                .setContentIntent(pending)
                .build()

            nm.notify(WATCHDOG_NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            // A notification failure here shouldn't fail the whole work run —
            // there's nothing to retry, the next scheduled check will try again.
        }

        return Result.success()
    }
}
