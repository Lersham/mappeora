import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.mappeora.app',
  appName: 'MappAmi',
  webDir: 'dist',
  ios: {
    // Every plugin except @capacitor-mlkit/text-recognition: ML Kit only
    // supports CocoaPods, so iOS uses our Vision plugin (ios/App/App/OcrPlugin.swift).
    // Remember to add new native plugins here too.
    includePlugins: [
      '@capacitor-community/sqlite',
      '@capacitor-community/text-to-speech',
      '@capacitor/camera',
      '@capacitor/filesystem',
      '@capacitor/share',
      '@capgo/capacitor-speech-recognition',
    ],
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
};

export default config;
