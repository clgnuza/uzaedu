/// `--dart-define` ile PWA ile aynı Firebase projesi
class FirebaseConfig {
  static String get apiKey =>
      const String.fromEnvironment('FIREBASE_API_KEY', defaultValue: '');
  static String get authDomain =>
      const String.fromEnvironment('FIREBASE_AUTH_DOMAIN', defaultValue: '');
  static String get projectId =>
      const String.fromEnvironment('FIREBASE_PROJECT_ID', defaultValue: '');
  static String get storageBucket =>
      const String.fromEnvironment('FIREBASE_STORAGE_BUCKET', defaultValue: '');
  static String get messagingSenderId =>
      const String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID', defaultValue: '');
  static String get appId =>
      const String.fromEnvironment('FIREBASE_APP_ID', defaultValue: '');

  static bool get isConfigured =>
      apiKey.isNotEmpty && authDomain.isNotEmpty && projectId.isNotEmpty;
}
