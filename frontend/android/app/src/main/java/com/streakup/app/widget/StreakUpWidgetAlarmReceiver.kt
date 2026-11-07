package com.streakup.app.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class StreakUpWidgetAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "StreakUpWidgetAlarmReceiver triggered. Updating widget and scheduling next transition.")
        try {
            // Update all widgets with the new time-based motivational message
            StreakUpWidgetProvider.updateAllWidgets(context)

            // Schedule the next transition alarm (5:00 PM or Midnight)
            StreakUpWidgetProvider.scheduleNextTriggers(context)

            // Enqueue network sync to ensure fresh data
            StreakUpWidgetWorker.enqueueOneTimeSync(context)
        } catch (t: Throwable) {
            Log.e(TAG, "Error in widget alarm receiver: ${t.message}", t)
        }
    }

    companion object {
        private const val TAG = "StreakUpWidgetAlarm"
    }
}

