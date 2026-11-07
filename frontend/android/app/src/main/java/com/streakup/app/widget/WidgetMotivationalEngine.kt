package com.streakup.app.widget

/**
 * Contextual motivational engine for StreakUp Android Home Screen Widget.
 *
 * Evaluates:
 * 1. User local time (Morning, Midday, Afternoon, 5:00 PM cutoff, Evening, Night)
 * 2. Task completion state (All completed, 1 left / almost there, in progress, none started, 0 tasks)
 * 3. User streak status (Active streak, Day 1, Streak secured)
 *
 * Strictly produces short, punchy, elegant messages matching the exact user specifications.
 */
object WidgetMotivationalEngine {

    data class ContextualMotivation(
        val message: String,
        val isCompleted: Boolean,
        val textColorHex: String
    )

    fun resolveMotivation(
        completedToday: Int,
        totalTasks: Int,
        streak: Int,
        hourOfDay: Int
    ): ContextualMotivation {
        val isAfter5Pm = hourOfDay >= 17

        // STATE GROUP 1: All tasks completed (100% finished for today)
        if (totalTasks > 0 && completedToday >= totalTasks) {
            val message = when {
                hourOfDay >= 20 -> "Done for today. See you tomorrow."
                streak > 1 -> "Today's goal achieved."
                hourOfDay < 12 -> "Morning mission completed."
                else -> "Done for today. See you tomorrow."
            }
            // Elegant emerald green text indicating full achievement
            return ContextualMotivation(message, isCompleted = true, textColorHex = "#34d399")
        }

        // STATE GROUP 2: No tasks scheduled today
        if (totalTasks == 0) {
            val message = if (isAfter5Pm) {
                "Ready for tomorrow's streak."
            } else {
                "Plan your goals for today."
            }
            return ContextualMotivation(message, isCompleted = false, textColorHex = "#a1a1aa")
        }

        val remaining = totalTasks - completedToday

        // STATE GROUP 3: After 5:00 PM with incomplete tasks (Evening focus & urgency)
        if (isAfter5Pm) {
            val message = when {
                // Almost there (1 task left after 5 PM)
                remaining == 1 -> "Almost there. Finish strong."
                // Late evening (9 PM or later)
                hourOfDay >= 21 -> "Your streak is waiting."
                // 0 tasks completed after 5 PM
                completedToday == 0 -> "Still time. Finish strong."
                // 8 PM to 9 PM
                hourOfDay >= 20 -> "Make today count."
                // General evening incomplete
                streak > 0 -> "Your streak is waiting."
                else -> "Still time. Finish strong."
            }
            // Warm amber text for evening urgency
            return ContextualMotivation(message, isCompleted = false, textColorHex = "#fbbf24")
        }

        // STATE GROUP 4: Before 5:00 PM with incomplete tasks
        val message = when {
            // Almost there (1 task left before 5 PM)
            remaining == 1 -> "Almost there."
            // Early morning (before 9 AM, 0 done)
            hourOfDay < 9 && completedToday == 0 -> "One step at a time."
            // Morning (9 AM - 12 PM, 0 done)
            hourOfDay < 12 && completedToday == 0 -> "Keep going."
            // Midday (12 PM - 3 PM, in progress)
            hourOfDay in 12..14 && completedToday > 0 -> "Keep going."
            // Afternoon (3 PM - 5 PM, in progress)
            hourOfDay in 15..16 && completedToday > 0 -> "One step at a time."
            // In progress general
            completedToday > 0 -> "Keep going."
            else -> "One step at a time."
        }
        // Subtle muted slate for daytime focus
        return ContextualMotivation(message, isCompleted = false, textColorHex = "#a1a1aa")
    }
}
