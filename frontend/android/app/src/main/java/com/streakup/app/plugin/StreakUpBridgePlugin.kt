package com.streakup.app.plugin

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.streakup.app.security.SecureStorage
import com.streakup.app.widget.StreakUpWidgetProvider
import com.streakup.app.widget.StreakUpWidgetWorker

@CapacitorPlugin(name = "StreakUpBridge")
class StreakUpBridgePlugin : Plugin() {

    @PluginMethod
    fun syncAuthToken(call: PluginCall) {
        val token = call.getString("token")
        if (!token.isNullOrBlank()) {
            SecureStorage.saveAuthToken(context, token)
            StreakUpWidgetWorker.enqueueOneTimeSync(context)
            call.resolve()
        } else {
            call.reject("Token must not be empty")
        }
    }

    @PluginMethod
    fun clearAuthToken(call: PluginCall) {
        SecureStorage.clearAuth(context)
        StreakUpWidgetProvider.updateAllWidgets(context)
        call.resolve()
    }

    @PluginMethod
    fun syncWidgetData(call: PluginCall) {
        val streak = call.getInt("streak") ?: 0
        val completedToday = call.getInt("completedToday") ?: 0
        val totalTasks = call.getInt("totalTasks") ?: 0
        val percentage = call.getInt("percentage") ?: 0
        val userName = call.getString("userName")
        val statusMessage = call.getString("statusMessage")

        SecureStorage.saveWidgetStats(
            context = context,
            streak = streak,
            completedToday = completedToday,
            totalTasks = totalTasks,
            percentage = percentage,
            userName = userName,
            statusMessage = statusMessage
        )

        StreakUpWidgetProvider.updateAllWidgets(context)
        call.resolve()
    }

    @PluginMethod
    fun triggerWidgetUpdate(call: PluginCall) {
        StreakUpWidgetWorker.enqueueOneTimeSync(context)
        call.resolve()
    }
}

