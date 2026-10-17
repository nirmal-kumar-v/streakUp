"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayInTimezone = exports.SUPPORTED_TIMEZONES = exports.DEFAULT_TIMEZONE = void 0;
exports.isValidTimezone = isValidTimezone;
exports.getLocalDateString = getLocalDateString;
exports.getYesterdayDateString = getYesterdayDateString;
exports.getLocalTimeInfo = getLocalTimeInfo;
const luxon_1 = require("luxon");
exports.DEFAULT_TIMEZONE = 'Asia/Kolkata';
exports.SUPPORTED_TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST) - Asia/Kolkata (GMT+5:30)' },
    { value: 'America/New_York', label: 'Eastern Time (ET) - America/New_York' },
    { value: 'America/Chicago', label: 'Central Time (CT) - America/Chicago' },
    { value: 'America/Denver', label: 'Mountain Time (MT) - America/Denver' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - America/Los_Angeles' },
    { value: 'Europe/London', label: 'Greenwich / British Summer Time - Europe/London' },
    { value: 'Europe/Paris', label: 'Central European Time - Europe/Paris' },
    { value: 'Europe/Berlin', label: 'Central European Time - Europe/Berlin' },
    { value: 'Asia/Dubai', label: 'Gulf Standard Time - Asia/Dubai' },
    { value: 'Asia/Singapore', label: 'Singapore Time - Asia/Singapore' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time - Asia/Tokyo' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time - Australia/Sydney' },
    { value: 'UTC', label: 'Coordinated Universal Time - UTC' },
];
/**
 * Validates whether a timezone identifier is recognized by the runtime.
 */
function isValidTimezone(tz) {
    if (!tz || typeof tz !== 'string')
        return false;
    return luxon_1.DateTime.now().setZone(tz).isValid;
}
/**
 * Gets the current date string (YYYY-MM-DD) in the specified timezone.
 */
function getLocalDateString(timezone = exports.DEFAULT_TIMEZONE, date) {
    const zone = isValidTimezone(timezone) ? timezone : exports.DEFAULT_TIMEZONE;
    const dt = date ? luxon_1.DateTime.fromJSDate(date).setZone(zone) : luxon_1.DateTime.now().setZone(zone);
    return dt.toFormat('yyyy-MM-dd');
}
exports.getTodayInTimezone = getLocalDateString;
/**
 * Gets yesterday's date string (YYYY-MM-DD) in the specified timezone.
 */
function getYesterdayDateString(timezone = exports.DEFAULT_TIMEZONE, referenceDate) {
    const zone = isValidTimezone(timezone) ? timezone : exports.DEFAULT_TIMEZONE;
    const dt = referenceDate ? luxon_1.DateTime.fromJSDate(referenceDate).setZone(zone) : luxon_1.DateTime.now().setZone(zone);
    return dt.minus({ days: 1 }).toFormat('yyyy-MM-dd');
}
/**
 * Returns current local time details and countdown to next midnight.
 */
function getLocalTimeInfo(timezone = exports.DEFAULT_TIMEZONE) {
    const zone = isValidTimezone(timezone) ? timezone : exports.DEFAULT_TIMEZONE;
    const now = luxon_1.DateTime.now().setZone(zone);
    // Next local midnight: start of next day
    const nextMidnight = now.plus({ days: 1 }).startOf('day');
    const diff = nextMidnight.diff(now, ['hours', 'minutes', 'seconds', 'milliseconds']);
    const totalSecondsRemaining = Math.max(0, Math.floor(diff.as('seconds')));
    const hoursRemaining = Math.floor(totalSecondsRemaining / 3600);
    const minutesRemaining = Math.floor((totalSecondsRemaining % 3600) / 60);
    const secondsRemaining = totalSecondsRemaining % 60;
    return {
        timezone: zone,
        currentIso: now.toISO(),
        timeFormatted: now.toFormat('hh:mm:ss a'),
        dateFormatted: now.toFormat('cccc, MMMM d, yyyy'),
        todayDateString: now.toFormat('yyyy-MM-dd'),
        nextMidnightIso: nextMidnight.toISO(),
        countdown: {
            totalSecondsRemaining,
            hours: hoursRemaining,
            minutes: minutesRemaining,
            seconds: secondsRemaining,
            formatted: `${String(hoursRemaining).padStart(2, '0')}:${String(minutesRemaining).padStart(2, '0')}:${String(secondsRemaining).padStart(2, '0')}`,
        }
    };
}
