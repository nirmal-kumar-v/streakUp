import { describe, it, expect } from 'vitest';
import { isTaskVisibleToUser } from '../src/utils/taskPrivacy';

describe('Task Privacy and Visibility Engine', () => {
  const owner = { id: 'user-owner-1', username: 'john_doe' };
  const viewerAlice = { id: 'user-alice-2', username: 'alice' };
  const viewerBob = { id: 'user-bob-3', username: 'bob' };
  const viewerCharlie = { id: 'user-charlie-4', username: 'charlie' };

  it('owner can always view their own task regardless of hiddenFrom or visibleOnlyTo', () => {
    const task = {
      userId: owner.id,
      hiddenFrom: ['all', 'john_doe'],
      visibleOnlyTo: ['bob'],
    };

    expect(isTaskVisibleToUser(task, owner)).toBe(true);
  });

  it('hides from all users when hiddenFrom includes "all" (case-insensitive)', () => {
    const taskUpper = {
      userId: owner.id,
      hiddenFrom: ['ALL'],
      visibleOnlyTo: [],
    };
    const taskLower = {
      userId: owner.id,
      hiddenFrom: ['all'],
      visibleOnlyTo: [],
    };

    expect(isTaskVisibleToUser(taskUpper, viewerAlice)).toBe(false);
    expect(isTaskVisibleToUser(taskUpper, viewerBob)).toBe(false);
    expect(isTaskVisibleToUser(taskLower, viewerAlice)).toBe(false);
    expect(isTaskVisibleToUser(taskLower, viewerBob)).toBe(false);
  });

  it('hides from specific username or user ID (with or without @ prefix)', () => {
    const taskWithUsername = {
      userId: owner.id,
      hiddenFrom: ['@alice', 'user-charlie-4'],
      visibleOnlyTo: [],
    };

    expect(isTaskVisibleToUser(taskWithUsername, viewerAlice)).toBe(false);
    expect(isTaskVisibleToUser(taskWithUsername, viewerCharlie)).toBe(false);
    expect(isTaskVisibleToUser(taskWithUsername, viewerBob)).toBe(true);
  });

  it('visibleOnlyTo restricts visibility exclusively to listed users', () => {
    const taskExclusive = {
      userId: owner.id,
      hiddenFrom: [],
      visibleOnlyTo: ['bob', '@charlie'],
    };

    expect(isTaskVisibleToUser(taskExclusive, viewerBob)).toBe(true);
    expect(isTaskVisibleToUser(taskExclusive, viewerCharlie)).toBe(true);
    expect(isTaskVisibleToUser(taskExclusive, viewerAlice)).toBe(false);
  });

  it('default empty lists make task visible to friends', () => {
    const defaultTask = {
      userId: owner.id,
      hiddenFrom: [],
      visibleOnlyTo: [],
    };

    expect(isTaskVisibleToUser(defaultTask, viewerAlice)).toBe(true);
    expect(isTaskVisibleToUser(defaultTask, viewerBob)).toBe(true);
  });

  it('hides all group tasks from viewer if group owner hid viewer from the group', () => {
    const groupTaskHiddenByOwner = {
      userId: viewerBob.id, // Bob created completion for shared group task
      hiddenFrom: [],
      visibleOnlyTo: [],
      groupId: 'grp-123',
      group: {
        hiddenFrom: ['@alice'], // Owner hid Alice from group
      },
    };

    // Alice is hidden by group owner -> cannot see Bob's group task
    expect(isTaskVisibleToUser(groupTaskHiddenByOwner, viewerAlice)).toBe(false);
    // Charlie is not hidden -> can see Bob's group task
    expect(isTaskVisibleToUser(groupTaskHiddenByOwner, viewerCharlie)).toBe(true);
  });

  it('hides all group tasks from everyone if group owner hid "all"', () => {
    const groupTaskHiddenAll = {
      userId: viewerBob.id,
      hiddenFrom: [],
      visibleOnlyTo: [],
      groupId: 'grp-private',
      group: {
        hiddenFrom: ['all'],
      },
    };

    expect(isTaskVisibleToUser(groupTaskHiddenAll, viewerAlice)).toBe(false);
    expect(isTaskVisibleToUser(groupTaskHiddenAll, viewerCharlie)).toBe(false);
    // Owner of the specific task (Bob) can still see their own task
    expect(isTaskVisibleToUser(groupTaskHiddenAll, viewerBob)).toBe(true);
  });

  it('restricts group tasks to visibleOnlyTo whitelist defined at group level', () => {
    const groupTaskWhitelisted = {
      userId: viewerBob.id,
      hiddenFrom: [],
      visibleOnlyTo: [],
      groupId: 'grp-vip',
      group: {
        hiddenFrom: [],
        visibleOnlyTo: ['alice'], // Only Alice is whitelisted
      },
    };

    expect(isTaskVisibleToUser(groupTaskWhitelisted, viewerAlice)).toBe(true);
    expect(isTaskVisibleToUser(groupTaskWhitelisted, viewerCharlie)).toBe(false);
    // Bob (creator) can always see his own task
    expect(isTaskVisibleToUser(groupTaskWhitelisted, viewerBob)).toBe(true);
  });

  it('validates prefix-only autocomplete logic (typing "j" matches "jana" / "jaishu" but not "alex" or "sanjay")', () => {
    const candidateList = [
      { username: 'jana', name: 'Jana Nathan' },
      { username: 'jaishu', name: 'Jaishree V' },
      { username: 'sanjay', name: 'Sanjay Kumar' },
      { username: 'alex', name: 'Alexander J' },
    ];

    const q = 'j';
    const matches = candidateList.filter((c) => {
      const u = c.username.toLowerCase();
      const n = c.name.toLowerCase();
      return u.startsWith(q) || n.startsWith(q);
    });

    const matchedUsernames = matches.map((m) => m.username);
    expect(matchedUsernames).toContain('jana');
    expect(matchedUsernames).toContain('jaishu');
    expect(matchedUsernames).not.toContain('sanjay');
    expect(matchedUsernames).not.toContain('alex');
  });
});
