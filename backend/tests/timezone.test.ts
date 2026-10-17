import { describe, it, expect } from 'vitest';
import { getLocalTimeInfo, isValidTimezone, getLocalDateString, getYesterdayDateString } from '../src/services/timezoneService';

describe('Timezone & Midnight Countdown Logic', () => {
  it('should validate standard IANA timezones', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Invalid/Fake_Zone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });

  it('should calculate non-negative countdown until midnight', () => {
    const timeInfo = getLocalTimeInfo('Asia/Kolkata');

    expect(timeInfo.timezone).toBe('Asia/Kolkata');
    expect(timeInfo.countdown.totalSecondsRemaining).toBeGreaterThanOrEqual(0);
    expect(timeInfo.countdown.totalSecondsRemaining).toBeLessThanOrEqual(86400); // Max 24 hours
    expect(timeInfo.countdown.hours).toBeGreaterThanOrEqual(0);
    expect(timeInfo.countdown.hours).toBeLessThan(24);
    expect(timeInfo.countdown.minutes).toBeGreaterThanOrEqual(0);
    expect(timeInfo.countdown.minutes).toBeLessThan(60);
    expect(timeInfo.countdown.seconds).toBeGreaterThanOrEqual(0);
    expect(timeInfo.countdown.seconds).toBeLessThan(60);
    expect(timeInfo.countdown.formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should calculate local date string and yesterday accurately', () => {
    const today = getLocalDateString('Asia/Kolkata');
    const yesterday = getYesterdayDateString('Asia/Kolkata');

    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).not.toBe(yesterday);
  });
});
