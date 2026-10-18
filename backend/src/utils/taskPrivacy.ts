/**
 * Helper to determine whether a task is visible to a given viewer.
 *
 * Rules:
 * 1. The owner of the task can always see their own task.
 * 2. If 'hiddenFrom' includes 'all' (case-insensitive), it is hidden from all other users.
 * 3. If 'hiddenFrom' includes the viewer's ID or username, it is hidden from the viewer.
 * 4. If 'visibleOnlyTo' is non-empty, ONLY users whose ID or username is in 'visibleOnlyTo' can view it.
 */
export function isTaskVisibleToUser(
  task: {
    userId: string;
    hiddenFrom?: string[] | null;
    visibleOnlyTo?: string[] | null;
  },
  viewer: {
    id: string;
    username?: string | null;
  }
): boolean {
  // Owner always sees own task
  if (task.userId === viewer.id) {
    return true;
  }

  const hidden = (task.hiddenFrom || []).map((h) => h.trim().toLowerCase().replace(/^@/, ''));
  const visible = (task.visibleOnlyTo || []).map((v) => v.trim().toLowerCase().replace(/^@/, ''));

  const viewerId = viewer.id.toLowerCase();
  const viewerUsername = (viewer.username || '').toLowerCase().replace(/^@/, '');

  // 1. Check hiddenFrom
  if (hidden.length > 0) {
    // If hidden from 'all', hide from everyone
    if (hidden.includes('all')) {
      return false;
    }
    // If hidden from this specific user
    if (hidden.includes(viewerId) || (viewerUsername && hidden.includes(viewerUsername))) {
      return false;
    }
  }

  // 2. Check visibleOnlyTo
  if (visible.length > 0) {
    // Must be explicitly in visibleOnlyTo
    const isAllowed = visible.includes(viewerId) || (viewerUsername && visible.includes(viewerUsername));
    if (!isAllowed) {
      return false;
    }
  }

  return true;
}
