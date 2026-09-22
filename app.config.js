// Expo app config. Values that differ per build environment come from
// EXPO_PUBLIC_* env vars so a fresh clone runs without editing this file.
module.exports = {
  expo: {
    name: "Breakaway Roping",
    slug: "breakawayroping",
    scheme: "breakawayroping",
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: "#140b1c",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "pro.breakawayroping.app",
      buildNumber: "1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'Record your runs so BreakawayRoping can analyse them.',
        NSMicrophoneUsageDescription: 'Capture audio alongside your run video.',
        NSPhotoLibraryUsageDescription: 'Pick a run video to analyse.',
      },
    },
    android: {
      package: "pro.breakawayroping.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: "#140b1c",
      },
      edgeToEdgeEnabled: true,
    },
    web: { bundler: 'metro', output: 'static', favicon: './assets/favicon.png' },
    plugins: ['expo-router', 'expo-video'],
    experiments: { typedRoutes: true },
    extra: {
      eas: {
        projectId: "d8e86a99-baa5-475a-a3aa-ae3b66a128a2"
      },
      domain: "breakawayroping.pro",
      eventType: "breakawayroping",
      // Legal + support URLs (from breakawayroping.pro). Referenced by the
      // in-app Support/Settings screens and required for store submission.
      privacyUrl: "https://www.breakawayroping.pro/privacy",
      termsUrl: "https://www.breakawayroping.pro/terms",
      supportUrl: "https://www.breakawayroping.pro/support",
      refundUrl: "https://www.breakawayroping.pro/refund",
      supportEmail: "support@breakawayroping.pro",
    },
  },
};
