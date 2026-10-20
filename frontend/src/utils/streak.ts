/**
 * Computes the optimistic user streak when completing a task.
 * 
 * Rules:
 * - If other tasks were already completed today, streak remains unchanged.
 * - If the user created their account today, streak cannot exceed 1.
 * - If this is the user's first completion ever, streak becomes 1.
 * - Otherwise (continuing streak from a previous day), streak increments by 1.
 */
export function calculateOptimisticUserStreak(
  currentStreak: number,
  hasOtherCompletedToday: boolean,
  userCreatedAt?: string
): number {
  if (hasOtherCompletedToday) {
    return Math.max(1, currentStreak);
  }

  // If user account was created today (same local calendar date), streak is at most 1
  if (userCreatedAt) {
    try {
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const createdDate = new Date(userCreatedAt);
      const createdLocal = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')}`;
      if (localToday === createdLocal) {
        return 1;
      }
    } catch {
      // ignore parsing errors
    }
  }

  return currentStreak === 0 ? 1 : currentStreak + 1;
}
