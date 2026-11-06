package com.streakup.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.streakup.app.plugin.StreakUpBridgePlugin
import com.streakup.app.widget.StreakUpWidgetWorker

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(StreakUpBridgePlugin::class.java)
        super.onCreate(savedInstanceState)

        // Schedule battery-friendly periodic background widget refresh
        StreakUpWidgetWorker.enqueuePeriodicWork(this)
    }
}

