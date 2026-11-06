package com.streakup.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.streakup.app.MainActivity
import com.streakup.app.R
import com.streakup.app.security.SecureStorage

class StreakUpWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        // Enqueue background work when the first widget instance is placed on the home screen
        StreakUpWidgetWorker.enqueuePeriodicWork(context)
    }

    companion object {
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_streakup)
            val isLoggedIn = SecureStorage.isLoggedIn(context)

            if (isLoggedIn) {
                views.setViewVisibility(R.id.widget_logged_in_container, View.VISIBLE)
                views.setViewVisibility(R.id.widget_logged_out_container, View.GONE)

                val stats = SecureStorage.getWidgetStats(context)

                // Streak counter
                views.setTextViewText(R.id.widget_streak_count, stats.streak.toString())

                // Tasks fraction
                val tasksCountText = if (stats.totalTasks > 0) {
                    "${stats.completedToday} / ${stats.totalTasks} Done"
                } else {
                    "No tasks today"
                }
                views.setTextViewText(R.id.widget_tasks_count, tasksCountText)

                // Progress Bar & Percentage
                val clampedPercentage = stats.percentage.coerceIn(0, 100)
                views.setProgressBar(R.id.widget_progress_bar, 100, clampedPercentage, false)
                views.setTextViewText(R.id.widget_progress_percentage, "$clampedPercentage%")

                // User name header
                views.setTextViewText(
                    R.id.widget_user_name,
                    if (!stats.userName.isNullOrBlank()) stats.userName else "Daily Focus"
                )

                // Contextual status message
                val statusText = when {
                    !stats.statusMessage.isNullOrBlank() -> stats.statusMessage
                    stats.totalTasks > 0 && stats.completedToday >= stats.totalTasks -> "🎉 All caught up for today!"
                    stats.totalTasks > 0 -> "${stats.totalTasks - stats.completedToday} tasks left today"
                    else -> "Tap to open your dashboard"
                }
                views.setTextViewText(R.id.widget_status_message, statusText)
            } else {
                views.setViewVisibility(R.id.widget_logged_in_container, View.GONE)
                views.setViewVisibility(R.id.widget_logged_out_container, View.VISIBLE)
            }

            // Clicking any part of the widget launches the StreakUp dashboard
            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse("streakup://dashboard")
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
        }

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, StreakUpWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(component)
            if (appWidgetIds.isNotEmpty()) {
                for (id in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, id)
                }
            }
        }
    }
}

