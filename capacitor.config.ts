import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pallenestam.app',
  appName: 'Palle Nestham',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
