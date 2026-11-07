package com.streakup.app.plugin

import android.content.ContentValues
import android.content.Intent
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.streakup.app.security.SecureStorage
import com.streakup.app.widget.StreakUpWidgetProvider
import com.streakup.app.widget.StreakUpWidgetWorker
import java.io.File
import java.io.FileOutputStream

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

    @PluginMethod
    fun downloadImage(call: PluginCall) {
        val base64Data = call.getString("base64Data")
        val fileName = call.getString("fileName") ?: "StreakUp_Card_${System.currentTimeMillis()}.png"

        if (base64Data.isNullOrBlank()) {
            call.reject("base64Data is required")
            return
        }

        try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }

            val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/StreakUp")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }

                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
                    ?: throw Exception("Failed to create MediaStore entry")

                resolver.openOutputStream(uri)?.use { outputStream ->
                    outputStream.write(imageBytes)
                }

                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)

                val ret = JSObject()
                ret.put("success", true)
                ret.put("uri", uri.toString())
                call.resolve(ret)
            } else {
                val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "StreakUp")
                if (!dir.exists()) dir.mkdirs()
                val file = File(dir, fileName)
                FileOutputStream(file).use { it.write(imageBytes) }

                MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf("image/png"), null)

                val ret = JSObject()
                ret.put("success", true)
                ret.put("path", file.absolutePath)
                call.resolve(ret)
            }
        } catch (t: Throwable) {
            Log.e("StreakUpBridge", "downloadImage failed: ${t.message}", t)
            call.reject("Failed to save image to gallery: ${t.message}")
        }
    }

    @PluginMethod
    fun shareImage(call: PluginCall) {
        val base64Data = call.getString("base64Data")
        val title = call.getString("title") ?: "StreakUp Streak Card"
        val text = call.getString("text") ?: "🔥 Keep the flame burning!"

        if (base64Data.isNullOrBlank()) {
            call.reject("base64Data is required")
            return
        }

        try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }

            val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            val cacheFile = File(context.cacheDir, "shared_streak_card.png")
            FileOutputStream(cacheFile).use { it.write(imageBytes) }

            val contentUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                cacheFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_TEXT, text)
                putExtra(Intent.EXTRA_SUBJECT, title)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, title).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(chooser)

            val ret = JSObject()
            ret.put("success", true)
            call.resolve(ret)
        } catch (t: Throwable) {
            Log.e("StreakUpBridge", "shareImage failed: ${t.message}", t)
            call.reject("Failed to open share sheet: ${t.message}")
        }
    }
}
