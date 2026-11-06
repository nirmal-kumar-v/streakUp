package com.streakup.app.widget

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.streakup.app.security.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class StreakUpWidgetWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val token = SecureStorage.getAuthToken(applicationContext)

        if (token.isNullOrBlank()) {
            Log.d(TAG, "No authentication token present. Skipping background widget fetch.")
            StreakUpWidgetProvider.updateAllWidgets(applicationContext)
            return@withContext Result.success()
        }

        var connection: HttpURLConnection? = null
        try {
            val url = URL(API_ENDPOINT)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15000
                readTimeout = 15000
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "StreakUp-Android-Widget/1.0")
                instanceFollowRedirects = true
            }

            val responseCode = connection.responseCode
            Log.d(TAG, "Dashboard summary response code: $responseCode")

            when (responseCode) {
                HttpURLConnection.HTTP_OK -> {
                    val reader = BufferedReader(InputStreamReader(connection.inputStream))
                    val response = reader.use { it.readText() }
                    val json = JSONObject(response)

                    if (json.optBoolean("success", false)) {
                        val userObj = json.optJSONObject("user")
                        val statsObj = json.optJSONObject("stats")

                        val streak = userObj?.optInt("currentStreak", 0) ?: 0
                        val userName = userObj?.optString("name", null)
                        val completedToday = statsObj?.optInt("completedTodayCount", 0) ?: 0
                        val totalTasks = statsObj?.optInt("totalActiveTasks", 0) ?: 0
                        val percentage = statsObj?.optInt("completionPercentage", 0) ?: 0

                        SecureStorage.saveWidgetStats(
                            context = applicationContext,
                            streak = streak,
                            completedToday = completedToday,
                            totalTasks = totalTasks,
                            percentage = percentage,
                            userName = userName
                        )

                        StreakUpWidgetProvider.updateAllWidgets(applicationContext)
                        Result.success()
                    } else {
                        Log.w(TAG, "API returned success=false: $response")
                        Result.retry()
                    }
                }
                HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> {
                    Log.w(TAG, "Session expired (HTTP $responseCode). Clearing native credentials.")
                    SecureStorage.clearAuth(applicationContext)
                    StreakUpWidgetProvider.updateAllWidgets(applicationContext)
                    Result.success()
                }
                else -> {
                    Log.w(TAG, "Server returned HTTP $responseCode during background refresh.")
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Network or parsing exception during widget background refresh: ${e.message}", e)
            // Preserve cached widget stats on network failures without crashing
            Result.retry()
        } finally {
            connection?.disconnect()
        }
    }

    companion object {
        private const val TAG = "StreakUpWidgetWorker"
        private const val WORK_NAME = "streakup_widget_periodic_refresh"
        const val API_ENDPOINT = "https://streak-up-karo.vercel.app/api/tasks/dashboard-summary"

        fun enqueuePeriodicWork(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            // 30 minute repeat interval with 15 minute flex interval (respects Android minimum of 15m)
            val workRequest = PeriodicWorkRequestBuilder<StreakUpWidgetWorker>(
                30, TimeUnit.MINUTES,
                15, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
        }

        fun enqueueOneTimeSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val workRequest = OneTimeWorkRequestBuilder<StreakUpWidgetWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueue(workRequest)
        }
    }
}

