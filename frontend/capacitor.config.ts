import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.streakup.app',
  appName: 'StreakUp',
  webDir: 'dist',
  server: {
    url: 'https://streak-up-henna.vercel.app',
    androidScheme: 'https',
    clearCache: true
  }
};

export default config;
