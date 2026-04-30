import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.municipio.sigma',
  appName: 'SIGMA Changuinola',
  webDir: 'dist',
  // Serve from local files (offline-first)
  server: {
    androidScheme: 'https',
    // Allow the app to work completely offline
    allowNavigation: ['qxmugkwcsxwxrwjshumg.supabase.co'],
  },
  plugins: {
    // Preferences plugin for key-value storage (replaces localStorage for native)
    Preferences: {
      // Uses native SharedPreferences on Android
    },
    // Network plugin for online/offline detection
    Network: {},
    // Splash Screen configuration
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0F2233',
      showSpinner: false,
      splashImmersive: true,
      splashFullScreen: true,
    },
  },
  android: {
    // Build configuration
    buildOptions: {
      signingType: 'apksigner',
    },
    // Allow cleartext (HTTP) for local dev only
    allowMixedContent: false,
    // Status bar color (dark to match app theme)
    backgroundColor: '#0F2233',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0F2233',
    // Status bar configuration for iOS
    statusBarStyle: 'light',
  },
};

export default config;
