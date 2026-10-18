// ─── NoGoon Home Screen Widget ───────────────────────────────────────────────
//
// Jetpack Compose Glance widget that shows today's walk-away count and the
// current streak directly on the Android home screen.
//
// DATA SOURCE:
//   The widget reads "widget_walk_aways_today", "widget_streak", and
//   "widget_date" from the "NoGoonBlocker" SharedPreferences.
//   These are written by AppBlockerModule.setTodayStats(), which is called
//   from JS (useAppBlocker.ts) whenever the walk-away count or streak changes.
//
//   If "widget_date" doesn't match today's date (e.g., the user hasn't opened
//   the app yet today), the widget shows 0 walk-aways for today rather than a
//   stale count from yesterday.
//
// SETUP (add to AndroidManifest.xml, inside <application> block):
//
//   <receiver
//       android:name=".NoGoonWidgetReceiver"
//       android:exported="true">
//     <intent-filter>
//       <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
//     </intent-filter>
//     <meta-data
//         android:name="android.appwidget.provider"
//         android:resource="@xml/nogoon_widget_info" />
//   </receiver>
//
// SETUP (create res/xml/nogoon_widget_info.xml):
//
//   <?xml version="1.0" encoding="utf-8"?>
//   <appwidget-provider
//     xmlns:android="http://schemas.android.com/apk/res/android"
//     android:minWidth="110dp"
//     android:minHeight="40dp"
//     android:updatePeriodMillis="1800000"
//     android:targetCellWidth="2"
//     android:targetCellHeight="1"
//     android:resizeMode="horizontal|vertical"
//     android:widgetCategory="home_screen"
//     android:initialKeyguardLayout="@layout/glance_default_loading_layout" />
//
// SETUP (add to build.gradle app-level dependencies):
//
//   implementation("androidx.glance:glance-appwidget:1.0.0")
//   implementation("androidx.glance:glance-material3:1.0.0")

package com.nogoon.app

import android.content.ComponentName
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ─── Widget ───────────────────────────────────────────────────────────────────

class NoGoonWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // Read today's stats from SharedPreferences
        val prefs = context.getSharedPreferences(
            NoGoonAccessibilityService.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        val today  = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val savedDate = prefs.getString("widget_date", "") ?: ""
        val walkAways = if (savedDate == today) prefs.getInt("widget_walk_aways_today", 0) else 0
        val streak    = prefs.getInt("widget_streak", 0)

        provideContent {
            WidgetContent(
                context       = context,
                walkAways     = walkAways,
                streak        = streak,
            )
        }
    }
}

// ─── UI ───────────────────────────────────────────────────────────────────────

@Composable
private fun WidgetContent(
    context: Context,
    walkAways: Int,
    streak: Int,
) {
    // Launch the app when tapped
    val componentName = ComponentName(context.packageName, "${context.packageName}.MainActivity")

    GlanceTheme {
        Row(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(Color(0xFF0D0C14))    // COLORS.background
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .clickable(actionStartActivity(componentName)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Walk-away count
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = walkAways.toString(),
                    style = TextStyle(
                        color = androidx.glance.color.ColorProvider(day = Color(0xFF4ADE80), night = Color(0xFF4ADE80)),
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                    )
                )
                Text(
                    text = "today",
                    style = TextStyle(
                        color = androidx.glance.color.ColorProvider(day = Color(0xFF6B7280), night = Color(0xFF6B7280)),
                        fontSize = 10.sp,
                    )
                )
            }

            Spacer(modifier = GlanceModifier.width(12.dp))

            // Divider
            Column(
                modifier = GlanceModifier
                    .width(1.dp)
                    .padding(vertical = 4.dp)
                    .background(Color(0xFF2A2938)),
            ) { }

            Spacer(modifier = GlanceModifier.width(12.dp))

            // Streak
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = streak.toString(),
                        style = TextStyle(
                            color = androidx.glance.color.ColorProvider(day = Color(0xFFF59E0B), night = Color(0xFFF59E0B)),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    )
                }
                Text(
                    text = "streak",
                    style = TextStyle(
                        color = androidx.glance.color.ColorProvider(day = Color(0xFF6B7280), night = Color(0xFF6B7280)),
                        fontSize = 10.sp,
                    )
                )
            }

            Spacer(modifier = GlanceModifier.defaultWeight())

            // NoGoon label
            Text(
                text = "NoGoon",
                style = TextStyle(
                    color = androidx.glance.color.ColorProvider(day = Color(0xFF374151), night = Color(0xFF374151)),
                    fontSize = 9.sp,
                )
            )
        }
    }
}

// ─── Receiver ─────────────────────────────────────────────────────────────────

class NoGoonWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NoGoonWidget()
}
