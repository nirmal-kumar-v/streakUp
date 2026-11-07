export type MilestoneTier =
  | 'bronze'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'ruby'
  | 'emerald'
  | 'titan'
  | 'mythic';

export interface StreakMilestone {
  days: number;
  name: string;
  title: string;
  tier: MilestoneTier;
  description: string;
  tagline: string;
  accentColor: string;
  glowColor: string;
  gradientStops: [string, string, string];
  ribbonText: string;
}

const BASE_MILESTONES: StreakMilestone[] = [
  {
    days: 25,
    name: '25-Day Bronze Flame',
    title: 'Bronze Streak Badge',
    tier: 'bronze',
    description: 'Awarded for maintaining 25 consecutive days of daily focus and unbroken momentum.',
    tagline: '25 Days Habit Streak',
    accentColor: '#F39C12',
    glowColor: 'rgba(243, 156, 18, 0.45)',
    gradientStops: ['#F9D423', '#FF4E50', '#7E2A0C'],
    ribbonText: '25 DAY STREAK',
  },
  {
    days: 50,
    name: '50-Day Gold Flame',
    title: 'Gold Streak Badge',
    tier: 'gold',
    description: 'Awarded for conquering 50 consecutive days of unwavering discipline and consistency.',
    tagline: '50 Days Coding Streak',
    accentColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.55)',
    gradientStops: ['#FFF099', '#FFAA00', '#7A4D00'],
    ribbonText: '50 DAY STREAK',
  },
  {
    days: 75,
    name: '75-Day Platinum Flame',
    title: 'Platinum Streak Badge',
    tier: 'platinum',
    description: 'Awarded for maintaining 75 days of relentless dedication and mental fortitude.',
    tagline: '75 Days Master Streak',
    accentColor: '#00E5FF',
    glowColor: 'rgba(0, 229, 255, 0.5)',
    gradientStops: ['#E0F7FA', '#00B4D8', '#003554'],
    ribbonText: '75 DAY STREAK',
  },
  {
    days: 100,
    name: '100-Day Century Diamond',
    title: 'Century Diamond Badge',
    tier: 'diamond',
    description: 'The monumental Century Mark: 100 days of absolute consistency and perseverance.',
    tagline: '100 Days Century Streak',
    accentColor: '#B388FF',
    glowColor: 'rgba(179, 136, 255, 0.55)',
    gradientStops: ['#EDE7F6', '#7C4DFF', '#311B92'],
    ribbonText: '100 DAY STREAK',
  },
  {
    days: 150,
    name: '150-Day Grandmaster Flame',
    title: 'Grandmaster Streak Badge',
    tier: 'ruby',
    description: '150 days of peak performance: proof of enduring resilience and supreme habit automation.',
    tagline: '150 Days Elite Streak',
    accentColor: '#FF3366',
    glowColor: 'rgba(255, 51, 102, 0.55)',
    gradientStops: ['#FF80AB', '#FF1744', '#880E4F'],
    ribbonText: '150 DAY STREAK',
  },
  {
    days: 200,
    name: '200-Day Champion Flame',
    title: 'Champion Double Century',
    tier: 'emerald',
    description: '200 unbroken days: double century achievement placing you among the top 1% of achievers.',
    tagline: '200 Days Champion Streak',
    accentColor: '#00E676',
    glowColor: 'rgba(0, 230, 118, 0.5)',
    gradientStops: ['#B9F6CA', '#00C853', '#1B5E20'],
    ribbonText: '200 DAY STREAK',
  },
  {
    days: 250,
    name: '250-Day Titan Flame',
    title: 'Titan Streak Badge',
    tier: 'titan',
    description: '250 days of unyielding devotion: legendary discipline sculpted into your daily identity.',
    tagline: '250 Days Titan Streak',
    accentColor: '#FF9100',
    glowColor: 'rgba(255, 145, 0, 0.55)',
    gradientStops: ['#FFE082', '#FF6D00', '#BF360C'],
    ribbonText: '250 DAY STREAK',
  },
  {
    days: 300,
    name: '300-Day Mythic Flame',
    title: 'Mythic Streak Badge',
    tier: 'mythic',
    description: '300 consecutive days of mastery: an extraordinary milestone of rare perseverance.',
    tagline: '300 Days Mythic Streak',
    accentColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.65)',
    gradientStops: ['#FFF8E1', '#FFB300', '#E65100'],
    ribbonText: '300 DAY STREAK',
  },
  // After 300th day: 1 Year (365d), 2 Years (730d), 3 Years (1095d)...
  {
    days: 365,
    name: '1-Year Solar Master',
    title: '1-Year Streak Badge',
    tier: 'mythic',
    description: '365 consecutive days: a full solar revolution of unbroken dedication and supreme mastery.',
    tagline: '365 Days • 1 Year Streak',
    accentColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.75)',
    gradientStops: ['#FFFFFF', '#FFD700', '#FF8F00'],
    ribbonText: '1 YEAR STREAK',
  },
  {
    days: 730,
    name: '2-Year Immortal Legend',
    title: '2-Year Streak Badge',
    tier: 'titan',
    description: '730 days: two consecutive years of unwavering habit building. A legendary human milestone.',
    tagline: '730 Days • 2 Years Streak',
    accentColor: '#FF9100',
    glowColor: 'rgba(255, 145, 0, 0.75)',
    gradientStops: ['#FFF8E1', '#FF6D00', '#BF360C'],
    ribbonText: '2 YEARS STREAK',
  },
  {
    days: 1095,
    name: '3-Year Transcendent Flame',
    title: '3-Year Streak Badge',
    tier: 'diamond',
    description: '1,095 days: three complete years of relentless consistency. Transcendent willpower.',
    tagline: '1095 Days • 3 Years Streak',
    accentColor: '#B388FF',
    glowColor: 'rgba(179, 136, 255, 0.75)',
    gradientStops: ['#EDE7F6', '#7C4DFF', '#311B92'],
    ribbonText: '3 YEARS STREAK',
  },
];

/**
 * Returns all milestones. Beyond 3 years, adds subsequent annual milestones (4 years = 1460d, 5 years = 1825d...).
 * Strict rule: No 350, 400, 450, or 500. After 300, it is 1 Year (365d), 2 Years (730d), 3 Years (1095d)...
 */
export function getStreakMilestones(maxDays?: number): StreakMilestone[] {
  const highestLimit = Math.max(1095, maxDays || 0) + 365;
  const list = [...BASE_MILESTONES];

  let nextYear = 4;
  let nextDays = nextYear * 365; // 1460, 1825...
  while (nextDays <= highestLimit) {
    list.push({
      days: nextDays,
      name: `${nextYear}-Year Legend Flame`,
      title: `${nextYear}-Year Streak Badge`,
      tier: 'mythic',
      description: `${nextDays} days: ${nextYear} full years of unbroken excellence in the StreakUp Hall of Fame.`,
      tagline: `${nextDays} Days • ${nextYear} Years Streak`,
      accentColor: '#FFD700',
      glowColor: 'rgba(255, 215, 0, 0.8)',
      gradientStops: ['#FFFFFF', '#FFD700', '#FF6F00'],
      ribbonText: `${nextYear} YEARS STREAK`,
    });
    nextYear++;
    nextDays = nextYear * 365;
  }

  return list;
}

export function isMilestoneUnlocked(milestoneDays: number, currentStreak: number, longestStreak?: number): boolean {
  const effectiveBest = Math.max(currentStreak || 0, longestStreak || 0);
  return effectiveBest >= milestoneDays;
}

export function getHighestUnlockedMilestone(currentStreak: number, longestStreak?: number): StreakMilestone | null {
  const all = getStreakMilestones(Math.max(currentStreak || 0, longestStreak || 0));
  const effectiveBest = Math.max(currentStreak || 0, longestStreak || 0);
  const unlocked = all.filter((m) => effectiveBest >= m.days);
  if (unlocked.length === 0) return null;
  return unlocked[unlocked.length - 1];
}

export function getNextMilestone(currentStreak: number, longestStreak?: number): {
  nextMilestone: StreakMilestone;
  daysRemaining: number;
  progressPercent: number;
} | null {
  const effectiveBest = Math.max(currentStreak || 0, longestStreak || 0);
  const all = getStreakMilestones(effectiveBest + 400);
  const next = all.find((m) => m.days > currentStreak);
  if (!next) return null;

  // Previous milestone threshold
  const prevMilestoneDays = all
    .filter((m) => m.days < next.days)
    .reduce((max, m) => Math.max(max, m.days), 0);

  const span = next.days - prevMilestoneDays;
  const currentInSpan = Math.max(0, currentStreak - prevMilestoneDays);
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentInSpan / span) * 100)));
  const daysRemaining = Math.max(0, next.days - currentStreak);

  return {
    nextMilestone: next,
    daysRemaining,
    progressPercent,
  };
}

export interface OpenStreakModalDetail {
  currentStreak?: number;
  longestStreak?: number;
  userName?: string;
  userHandle?: string;
  userAvatar?: string | null;
  targetMilestoneDays?: number;
  isOwner?: boolean;
}

export function openStreakMilestoneModal(detail?: OpenStreakModalDetail): void {
  window.dispatchEvent(
    new CustomEvent('streakup_open_streak_modal', {
      detail: detail || {},
    })
  );
}
