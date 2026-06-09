/// API ve deep link — `flutter run` ile dart-define.
class AppConfig {
  AppConfig._();

  static String get apiBaseUrl {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    return 'http://10.0.2.2:4000/api';
  }

  static const optikDeepLinkScheme = 'uzaedu';
  static const optikDeepLinkHost = 'optik';

  /// Kare göndermeden önce kontrast (image paketi)
  static const bool omrEnhanceFrames =
      bool.fromEnvironment('OMR_ENHANCE_FRAMES', defaultValue: true);

  /// opencv_dart 2.x + `dart run opencv_dart:setup` (Flutter ≥3.38)
  static const bool omrOpencvEnhance =
      bool.fromEnvironment('OMR_OPENCV_ENHANCE', defaultValue: false);

  /// Google Play doğrulaması — `applicationId` ile aynı olmalı.
  static String get androidPackageName {
    const fromEnv = String.fromEnvironment('ANDROID_PACKAGE_NAME');
    if (fromEnv.isNotEmpty) return fromEnv;
    return 'com.uzaedu.ogretmenpro_optik';
  }
}
