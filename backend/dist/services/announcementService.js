"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformAnnouncement = getPlatformAnnouncement;
exports.updatePlatformAnnouncement = updatePlatformAnnouncement;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const ANNOUNCEMENT_FILE = path_1.default.join(DATA_DIR, 'announcement.json');
const DEFAULT_ANNOUNCEMENT = {
    id: 'default-announcement',
    active: false,
    message: '',
    type: 'info',
    link: '',
    linkText: '',
    dismissible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};
let cachedAnnouncement = null;
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function getPlatformAnnouncement() {
    if (cachedAnnouncement) {
        return cachedAnnouncement;
    }
    ensureDataDir();
    try {
        if (fs_1.default.existsSync(ANNOUNCEMENT_FILE)) {
            const raw = fs_1.default.readFileSync(ANNOUNCEMENT_FILE, 'utf-8');
            cachedAnnouncement = { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(raw) };
            return cachedAnnouncement;
        }
    }
    catch (err) {
        console.error('[AnnouncementService] Failed to read announcement file:', err);
    }
    cachedAnnouncement = { ...DEFAULT_ANNOUNCEMENT };
    return cachedAnnouncement;
}
function updatePlatformAnnouncement(data) {
    ensureDataDir();
    const current = getPlatformAnnouncement();
    const updated = {
        ...current,
        ...data,
        id: data.id || `announcement_${Date.now()}`,
        updatedAt: new Date().toISOString(),
    };
    try {
        fs_1.default.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[AnnouncementService] Failed to save announcement file (falling back to memory):', err);
    }
    cachedAnnouncement = updated;
    return updated;
}
