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
    private const val PREFS_FILE = "streakup_secure_prefs"
    private const val FALLBACK_PREFS_FILE = "streakup_private_prefs"

    private const val KEY_AUTH_TOKEN = "auth_jwt_token"
    private const val KEY_STREAK = "widget_streak"
    private const val KEY_COMPLETED = "widget_completed_today"
    private const val KEY_TOTAL = "widget_total_tasks"
    private const val KEY_PERCENTAGE = "widget_percentage"
    private const val KEY_USER_NAME = "widget_user_name"
    private const val KEY_STATUS_MSG = "widget_status_message"

    private fun getPreferences(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.w(TAG, "EncryptedSharedPreferences initialization failed, falling back to private SharedPreferences", e)
            context.getSharedPreferences(FALLBACK_PREFS_FILE, Context.MODE_PRIVATE)
        }
    }

    fun saveAuthToken(context: Context, token: String?) {
        val prefs = getPreferences(context)
        prefs.edit().apply {
            if (token.isNullOrBlank()) {
                remove(KEY_AUTH_TOKEN)
            } else {
                putString(KEY_AUTH_TOKEN, token.trim())
            }
            apply()
        }
    }

    fun getAuthToken(context: Context): String? {
        val prefs = getPreferences(context)
        return prefs.getString(KEY_AUTH_TOKEN, null)?.takeIf { it.isNotBlank() }
    }

    fun isLoggedIn(context: Context): Boolean {
        return !getAuthToken(context).isNullOrBlank()
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
        val prefs = getPreferences(context)
        prefs.edit().apply {
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
    }

    fun getWidgetStats(context: Context): WidgetStats {
        val prefs = getPreferences(context)
        return WidgetStats(
            streak = prefs.getInt(KEY_STREAK, 0),
            completedToday = prefs.getInt(KEY_COMPLETED, 0),
            totalTasks = prefs.getInt(KEY_TOTAL, 0),
            percentage = prefs.getInt(KEY_PERCENTAGE, 0),
            userName = prefs.getString(KEY_USER_NAME, null),
            statusMessage = prefs.getString(KEY_STATUS_MSG, null)
        )
    }

    fun clearAuth(context: Context) {
        val prefs = getPreferences(context)
        prefs.edit().clear().apply()
    }
}

