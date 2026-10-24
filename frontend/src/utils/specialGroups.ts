/**
 * Centralized Special Group Registry for Frontend
 * Shared definitions, generic checkbox support, and unambiguous platform detection.
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
    color: '#0A66C2',
    isAvailable: true,
    activityModel: 'LINKEDIN_GAMES',
    activities: [],
  },
  LEETCODE: {
    platform: 'LEETCODE',
    displayName: 'LeetCode',
    badgeLabel: 'LeetCode Special',
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
        description: 'Official LeetCode Problem of the Day. Completing POTD automatically completes Daily practice.',
      },
    ],
  },
  GEEKSFORGEEKS: {
    platform: 'GEEKSFORGEEKS',
    displayName: 'GeeksforGeeks',
    badgeLabel: 'GFG Special',
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
 */
export function detectSpecialPlatform(name?: string | null): SpecialPlatformType | null {
  if (!name) return null;
  const clean = name.trim();
  if (!clean) return null;

  const matches = new Set<SpecialPlatformType>();

  // 1. LinkedIn
  const cleanLi = clean.toLowerCase().replace(/[\s\-_]+/g, '');
  if (
    cleanLi === 'linkedin' ||
    cleanLi === 'linkdin' ||
    cleanLi === 'linked' ||
    cleanLi.includes('linkedin')
  ) {
    matches.add('LINKEDIN');
  }

  // 2. LeetCode
  if (/(\b|_|^)leetcode(\b|_|$)/i.test(clean) || /leetcode/i.test(clean.replace(/\s+/g, ''))) {
    matches.add('LEETCODE');
  }

  // 3. GeeksforGeeks / GFG
  const hasGfgToken = /\b(gfg)\b/i.test(clean);
  const hasGeeks =
    /geeks\s*for\s*geeks/i.test(clean) || /geeksforgeeks/i.test(clean.replace(/\s+/g, ''));
  if (hasGfgToken || hasGeeks) {
    matches.add('GEEKSFORGEEKS');
  }

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

export function getSpecialGroupMeta(platform?: string | null) {
  if (!platform) return null;
  const def = getSpecialGroupDefinition(platform);
  if (!def) return null;
  return {
    name: def.displayName,
    badge: def.badgeLabel,
    color: def.color,
  };
}
