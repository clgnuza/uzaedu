import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// Cihaz OCR (ML Kit).
Future<String> recognizeTextFromFile(String path) async {
  final input = InputImage.fromFilePath(path);
  final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
  try {
    final result = await recognizer.processImage(input);
    return result.text.trim();
  } finally {
    await recognizer.close();
  }
}
