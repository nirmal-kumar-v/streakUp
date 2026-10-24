/**
 * Centralized Special Group Registry for StreakUp
 * Supports extensible special-group platforms (LinkedIn, LeetCode, GeeksforGeeks, and future platforms).
 */

export type SpecialPlatformType = 'LINKEDIN' | 'LEETCODE' | 'GEEKSFORGEEKS';

export interface SpecialActivityMeta {
  id: 'daily' | 'potd' | string;
  name: string;
  shortLabel: string;
  tagline: string;
  description: string;
}

export interface SpecialGroupRegistryItem {
  platform: SpecialPlatformType;
  displayName: string;
  badgeLabel: string;
  icon: string;
  color: string;
  isAvailable: boolean;
  activityModel: 'LINKEDIN_GAMES' | 'DAILY_POTD';
  activities: SpecialActivityMeta[];
  defaultPotdCommitted?: boolean;
}

export const SPECIAL_GROUP_REGISTRY: Record<SpecialPlatformType, SpecialGroupRegistryItem> = {
  LINKEDIN: {
    platform: 'LINKEDIN',
    displayName: 'LinkedIn',
    badgeLabel: 'LinkedIn Games',
    icon: 'Linkedin',
    color: '#0A66C2',
    isAvailable: true,
    activityModel: 'LINKEDIN_GAMES',
    activities: [], // 8 games tracked in linkedInGameService
  },
  LEETCODE: {
    platform: 'LEETCODE',
    displayName: 'LeetCode',
    badgeLabel: 'LeetCode Special',
    icon: 'Code2',
    color: '#FFA116',
    isAvailable: true,
    activityModel: 'DAILY_POTD',
    defaultPotdCommitted: true,
    activities: [
      {
        id: 'daily',
        name: 'LeetCode Daily',
        shortLabel: 'Daily',
        tagline: 'Daily DSA Practice',
        description: 'Complete daily algorithmic problem solving practice.',
      },
      {
        id: 'potd',
        name: 'LeetCode POTD',
        shortLabel: 'POTD',
        tagline: 'Problem of the Day',
        description: "Official LeetCode Problem of the Day. Completing POTD automatically completes Daily practice.",
      },
    ],
  },
  GEEKSFORGEEKS: {
    platform: 'GEEKSFORGEEKS',
    displayName: 'GeeksforGeeks',
    badgeLabel: 'GFG Special',
    icon: 'Terminal',
    color: '#2F8D46',
    isAvailable: true,
    activityModel: 'DAILY_POTD',
    defaultPotdCommitted: true,
    activities: [
      {
        id: 'daily',
        name: 'GeeksforGeeks Daily',
        shortLabel: 'Daily',
        tagline: 'Daily Coding Practice',
        description: 'Complete daily coding and data structures practice.',
      },
      {
        id: 'potd',
        name: 'GeeksforGeeks POTD',
        shortLabel: 'POTD',
        tagline: 'Problem of the Day',
        description: 'Official GeeksforGeeks POTD challenge. Completing POTD automatically completes Daily practice.',
      },
    ],
  },
};

/**
 * Normalizes and detects if a group name unambiguously matches a supported special platform.
 * Case-insensitive, robust token matching for GFG, and rejects ambiguous names matching multiple platforms.
 */
export function detectSpecialPlatform(name?: string | null): SpecialPlatformType | null {
  if (!name) return null;
  const clean = name.trim();
  if (!clean) return null;

  const matches = new Set<SpecialPlatformType>();

  // 1. LinkedIn matching
  const cleanLi = clean.toLowerCase().replace(/[\s\-_]+/g, '');
  if (
    cleanLi === 'linkedin' ||
    cleanLi === 'linkdin' ||
    cleanLi === 'linked' ||
    cleanLi.includes('linkedin')
  ) {
    matches.add('LINKEDIN');
  }

  // 2. LeetCode matching
  if (/(\b|_|^)leetcode(\b|_|$)/i.test(clean) || /leetcode/i.test(clean.replace(/\s+/g, ''))) {
    matches.add('LEETCODE');
  }

  // 3. GeeksforGeeks / GFG matching (unambiguous \bgfg\b boundary or geeksforgeeks)
  const hasGfgToken = /\b(gfg)\b/i.test(clean);
  const hasGeeks =
    /geeks\s*for\s*geeks/i.test(clean) || /geeksforgeeks/i.test(clean.replace(/\s+/g, ''));
  if (hasGfgToken || hasGeeks) {
    matches.add('GEEKSFORGEEKS');
  }

  // Unambiguous: exactly one platform must match
  if (matches.size === 1) {
    const platform = Array.from(matches)[0];
    const def = SPECIAL_GROUP_REGISTRY[platform];
    if (def && def.isAvailable) {
      return platform;
    }
  }

  return null;
}

export function getSpecialGroupDefinition(platform?: string | null): SpecialGroupRegistryItem | null {
  if (!platform) return null;
  const upper = platform.toUpperCase() as SpecialPlatformType;
  return SPECIAL_GROUP_REGISTRY[upper] || null;
}

export function isSpecialPlatformAvailable(platform?: string | null): boolean {
  const def = getSpecialGroupDefinition(platform);
  return Boolean(def && def.isAvailable);
}
