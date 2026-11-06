package com.streakup.app.security

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

data class WidgetStats(
    val streak: Int,
    val completedToday: Int,
    val totalTasks: Int,
    val percentage: Int,
    val userName: String?,
    val statusMessage: String?
)

object SecureStorage {
    private const val TAG = "StreakUpSecureStorage"
    private const val SECURE_PREFS_FILE = "streakup_secure_prefs"
    private const val WIDGET_STATS_FILE = "streakup_widget_stats"
    private const val FALLBACK_PREFS_FILE = "streakup_private_prefs"

    private const val KEY_AUTH_TOKEN = "auth_jwt_token"
    private const val KEY_IS_LOGGED_IN = "is_logged_in"
    private const val KEY_STREAK = "widget_streak"
    private const val KEY_COMPLETED = "widget_completed_today"
    private const val KEY_TOTAL = "widget_total_tasks"
    private const val KEY_PERCENTAGE = "widget_percentage"
    private const val KEY_USER_NAME = "widget_user_name"
    private const val KEY_STATUS_MSG = "widget_status_message"

    /**
     * Retrieves Android Keystore-backed EncryptedSharedPreferences for the JWT token.
     * Falls back gracefully to private mode SharedPreferences if Keystore is unavailable.
     */
    private fun getSecurePreferences(context: Context): SharedPreferences {
        val appContext = context.applicationContext
        return try {
            val masterKey = MasterKey.Builder(appContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                appContext,
                SECURE_PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (t: Throwable) {
            Log.w(TAG, "EncryptedSharedPreferences fallback triggered: ${t.message}")
            appContext.getSharedPreferences(FALLBACK_PREFS_FILE, Context.MODE_PRIVATE)
        }
    }

    /**
     * Non-sensitive widget display stats (streak, task counts, progress).
     * Kept in standard private SharedPreferences so Android RemoteViews can read
     * instantly without any Keystore latency or cryptographic overhead.
     */
    private fun getWidgetStatsPreferences(context: Context): SharedPreferences {
        return context.applicationContext.getSharedPreferences(WIDGET_STATS_FILE, Context.MODE_PRIVATE)
    }

    fun saveAuthToken(context: Context, token: String?) {
        try {
            val securePrefs = getSecurePreferences(context)
            val widgetPrefs = getWidgetStatsPreferences(context)

            val trimmedToken = token?.trim()?.takeIf { it.isNotEmpty() }

            securePrefs.edit().apply {
                if (trimmedToken == null) {
                    remove(KEY_AUTH_TOKEN)
                } else {
                    putString(KEY_AUTH_TOKEN, trimmedToken)
                }
                apply()
            }

            widgetPrefs.edit().apply {
                putBoolean(KEY_IS_LOGGED_IN, trimmedToken != null)
                apply()
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Error saving auth token: ${t.message}", t)
        }
    }

    fun getAuthToken(context: Context): String? {
        return try {
            val securePrefs = getSecurePreferences(context)
            securePrefs.getString(KEY_AUTH_TOKEN, null)?.takeIf { it.isNotBlank() }
        } catch (t: Throwable) {
            Log.e(TAG, "Error reading auth token: ${t.message}", t)
            null
        }
    }

    fun isLoggedIn(context: Context): Boolean {
        return try {
            val widgetPrefs = getWidgetStatsPreferences(context)
            if (widgetPrefs.getBoolean(KEY_IS_LOGGED_IN, false)) {
                return true
            }
            !getAuthToken(context).isNullOrBlank()
        } catch (t: Throwable) {
            false
        }
    }

    fun saveWidgetStats(
        context: Context,
        streak: Int,
        completedToday: Int,
        totalTasks: Int,
        percentage: Int,
        userName: String?,
        statusMessage: String? = null
    ) {
        try {
            val prefs = getWidgetStatsPreferences(context)
            prefs.edit().apply {
                putBoolean(KEY_IS_LOGGED_IN, true)
                putInt(KEY_STREAK, streak)
                putInt(KEY_COMPLETED, completedToday)
                putInt(KEY_TOTAL, totalTasks)
                putInt(KEY_PERCENTAGE, percentage)
                putString(KEY_USER_NAME, userName)
                if (statusMessage != null) {
                    putString(KEY_STATUS_MSG, statusMessage)
                }
                apply()
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Error saving widget stats: ${t.message}", t)
        }
    }

    fun getWidgetStats(context: Context): WidgetStats {
        return try {
            val prefs = getWidgetStatsPreferences(context)
            WidgetStats(
                streak = prefs.getInt(KEY_STREAK, 0),
                completedToday = prefs.getInt(KEY_COMPLETED, 0),
                totalTasks = prefs.getInt(KEY_TOTAL, 0),
                percentage = prefs.getInt(KEY_PERCENTAGE, 0),
                userName = prefs.getString(KEY_USER_NAME, null),
                statusMessage = prefs.getString(KEY_STATUS_MSG, null)
            )
        } catch (t: Throwable) {
            WidgetStats(0, 0, 0, 0, null, null)
        }
    }

    fun clearAuth(context: Context) {
        try {
            getSecurePreferences(context).edit().clear().apply()
            getWidgetStatsPreferences(context).edit().clear().apply()
        } catch (t: Throwable) {
            Log.e(TAG, "Error clearing auth: ${t.message}", t)
        }
    }
}
