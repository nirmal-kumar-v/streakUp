package com.streakup.app.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import com.streakup.app.MainActivity
import com.streakup.app.R
import com.streakup.app.security.SecureStorage
import java.util.Calendar

class StreakUpWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        scheduleNextTriggers(context)
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        // Enqueue background work when the first widget instance is placed on the home screen
        StreakUpWidgetWorker.enqueuePeriodicWork(context)
        scheduleNextTriggers(context)
    }

    companion object {
        private const val TAG = "StreakUpWidgetProvider"
        private const val ALARM_REQUEST_CODE = 4401

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            try {
                val views = RemoteViews(context.packageName, R.layout.widget_streakup)
                val isLoggedIn = SecureStorage.isLoggedIn(context)

                if (isLoggedIn) {
                    views.setViewVisibility(R.id.widget_logged_in_container, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_logged_out_container, View.GONE)

                    val stats = SecureStorage.getWidgetStats(context)
                    val calendar = Calendar.getInstance()
                    val currentHour = calendar.get(Calendar.HOUR_OF_DAY)

                    // 1. Streak counter & flame unit
                    views.setTextViewText(R.id.widget_streak_count, stats.streak.toString())
                    views.setTextViewText(
                        R.id.widget_streak_unit,
                        if (stats.streak == 1) "🔥 DAY" else "🔥 DAYS"
                    )

                    // 2. Clean Task Count (e.g. 4 / 6) - No progress bar, no percentage
                    val tasksText = if (stats.totalTasks > 0) {
                        "${stats.completedToday} / ${stats.totalTasks}"
                    } else {
                        "0 / 0"
                    }
                    views.setTextViewText(R.id.widget_tasks_count, tasksText)

                    // Subtle background highlight when all tasks completed
                    val allCompleted = stats.totalTasks > 0 && stats.completedToday >= stats.totalTasks
                    if (allCompleted) {
                        views.setInt(
                            R.id.widget_tasks_container,
                            "setBackgroundResource",
                            R.drawable.widget_tasks_completed_background
                        )
                        views.setTextColor(R.id.widget_tasks_count, Color.parseColor("#34d399"))
                    } else {
                        views.setInt(
                            R.id.widget_tasks_container,
                            "setBackgroundResource",
                            R.drawable.widget_tasks_background
                        )
                        views.setTextColor(R.id.widget_tasks_count, Color.parseColor("#f4f4f5"))
                    }

                    // 3. User name header
                    views.setTextViewText(
                        R.id.widget_user_name,
                        if (!stats.userName.isNullOrBlank()) stats.userName else "Daily Focus"
                    )

                    // 4. Contextual motivational message based on time, completion, and streak
                    val motivation = WidgetMotivationalEngine.resolveMotivation(
                        completedToday = stats.completedToday,
                        totalTasks = stats.totalTasks,
                        streak = stats.streak,
                        hourOfDay = currentHour
                    )
                    views.setTextViewText(R.id.widget_status_message, motivation.message)
                    views.setTextColor(
                        R.id.widget_status_message,
                        Color.parseColor(motivation.textColorHex)
                    )
                } else {
                    views.setViewVisibility(R.id.widget_logged_in_container, View.GONE)
                    views.setViewVisibility(R.id.widget_logged_out_container, View.VISIBLE)
                }

                // Clicking anywhere on the widget launches the StreakUp dashboard
                val intent = Intent(context, MainActivity::class.java).apply {
                    action = Intent.ACTION_VIEW
                    data = Uri.parse("streakup://dashboard")
                    `package` = context.packageName
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }

                val pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

                appWidgetManager.updateAppWidget(appWidgetId, views)
            } catch (t: Throwable) {
                Log.e(TAG, "Error updating widget id $appWidgetId: ${t.message}", t)
                try {
                    // Safe fallback view so widget never displays a system loading error
                    val fallbackViews = RemoteViews(context.packageName, R.layout.widget_streakup)
                    fallbackViews.setViewVisibility(R.id.widget_logged_in_container, View.GONE)
                    fallbackViews.setViewVisibility(R.id.widget_logged_out_container, View.VISIBLE)

                    val intent = Intent(context, MainActivity::class.java).apply {
                        action = Intent.ACTION_MAIN
                        `package` = context.packageName
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    val pendingIntent = PendingIntent.getActivity(
                        context,
                        0,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    fallbackViews.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
                    appWidgetManager.updateAppWidget(appWidgetId, fallbackViews)
                } catch (fallbackError: Throwable) {
                    Log.e(TAG, "Fallback widget inflation error: ${fallbackError.message}", fallbackError)
                }
            }
        }

        fun updateAllWidgets(context: Context) {
            try {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val component = ComponentName(context, StreakUpWidgetProvider::class.java)
                val appWidgetIds = appWidgetManager.getAppWidgetIds(component)
                if (appWidgetIds != null && appWidgetIds.isNotEmpty()) {
                    for (id in appWidgetIds) {
                        updateAppWidget(context, appWidgetManager, id)
                    }
                }
            } catch (t: Throwable) {
                Log.e(TAG, "Error updating all widgets: ${t.message}", t)
            }
        }

        /**
         * Schedules the exact / inexact AlarmManager wakeup for:
         * 1. 5:00 PM today (if before 5 PM) or tomorrow
         * 2. Midnight (00:00) for new-day reset
         *
         * Accounts for Android Doze mode and background execution restrictions.
         */
        fun scheduleNextTriggers(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

                val now = Calendar.getInstance()

                // Target A: Next 5:00 PM (17:00)
                val fivePmCal = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 17)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                    if (timeInMillis <= now.timeInMillis) {
                        add(Calendar.DAY_OF_YEAR, 1)
                    }
                }

                // Target B: Next Midnight (00:00)
                val midnightCal = Calendar.getInstance().apply {
                    add(Calendar.DAY_OF_YEAR, 1)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 2)
                    set(Calendar.MILLISECOND, 0)
                }

                // Whichever comes first (5 PM or Midnight)
                val targetMillis = minOf(fivePmCal.timeInMillis, midnightCal.timeInMillis)

                val alarmIntent = Intent(context, StreakUpWidgetAlarmReceiver::class.java)
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    ALARM_REQUEST_CODE,
                    alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        targetMillis,
                        pendingIntent
                    )
                } else {
                    alarmManager.set(
                        AlarmManager.RTC_WAKEUP,
                        targetMillis,
                        pendingIntent
                    )
                }
                Log.d(TAG, "Scheduled next widget transition trigger for: $targetMillis (current: ${now.timeInMillis})")
            } catch (t: Throwable) {
                Log.w(TAG, "Failed to schedule widget trigger: ${t.message}")
            }
        }
    }
}
