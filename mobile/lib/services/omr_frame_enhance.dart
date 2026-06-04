import 'dart:convert';

import 'package:image/image.dart' as img;

import '../config/app_config.dart';

/// JPEG kare — kontrast (sunucu OpenCV öncesi). `OMR_OPENCV_ENHANCE` → opencv_dart (Flutter 3.38+).
Future<String> enhanceOmrDataUrl(String dataUrl) async {
  if (!AppConfig.omrEnhanceFrames) return dataUrl;
  if (AppConfig.omrOpencvEnhance) {
    try {
      return await enhanceOmrDataUrlOpencv(dataUrl);
    } catch (_) {}
  }
  return _enhanceWithImage(dataUrl);
}

Future<String> _enhanceWithImage(String dataUrl) async {
  final comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl;
  final bytes = base64Decode(dataUrl.substring(comma + 1));
  final decoded = img.decodeImage(bytes);
  if (decoded == null) return dataUrl;

  var g = img.grayscale(decoded);
  g = img.adjustColor(g, contrast: 1.15, gamma: 0.9, brightness: 0.02);

  final jpg = img.encodeJpg(g, quality: 88);
  return 'data:image/jpeg;base64,${base64Encode(jpg)}';
}

/// opencv_dart eklendiğinde `omr_opencv_enhance.dart` ile değiştirin.
Future<String> enhanceOmrDataUrlOpencv(String dataUrl) async {
  throw UnsupportedError('opencv_dart: pubspec + flutter 3.38, dart run opencv_dart:setup');
}
