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
});
