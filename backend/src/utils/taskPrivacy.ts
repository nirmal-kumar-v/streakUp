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
    groupId?: string | null;
    group?: {
      hiddenFrom?: string[] | null;
      visibleOnlyTo?: string[] | null;
    } | null;
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

  const viewerId = viewer.id.toLowerCase();
  const viewerUsername = (viewer.username || '').toLowerCase().replace(/^@/, '');

  // 1. Group-level privacy: If group owner hid this viewer from the group,
  // tasks belonging to this group are invisible to the viewer.
  if (task.group) {
    if (task.group.hiddenFrom && task.group.hiddenFrom.length > 0) {
      const groupHidden = task.group.hiddenFrom.map((h) => h.trim().toLowerCase().replace(/^@/, ''));
      if (groupHidden.includes('all') || groupHidden.includes(viewerId) || (viewerUsername && groupHidden.includes(viewerUsername))) {
        return false;
      }
    }
    if (task.group.visibleOnlyTo && task.group.visibleOnlyTo.length > 0) {
      const groupVisible = task.group.visibleOnlyTo.map((v) => v.trim().toLowerCase().replace(/^@/, ''));
      const isGroupAllowed = groupVisible.includes(viewerId) || (viewerUsername && groupVisible.includes(viewerUsername));
      if (!isGroupAllowed) {
        return false;
      }
    }
  }

  const hidden = (task.hiddenFrom || []).map((h) => h.trim().toLowerCase().replace(/^@/, ''));
  const visible = (task.visibleOnlyTo || []).map((v) => v.trim().toLowerCase().replace(/^@/, ''));

  // 2. Check task hiddenFrom
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

  // 3. Check visibleOnlyTo
  if (visible.length > 0) {
    // Must be explicitly in visibleOnlyTo
    const isAllowed = visible.includes(viewerId) || (viewerUsername && visible.includes(viewerUsername));
    if (!isAllowed) {
      return false;
    }
  }

  return true;
}
